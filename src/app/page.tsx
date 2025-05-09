"use client"
import { useState } from "react";
import styles from "./page.module.css";
import { rules } from "@/lib/linting";
import { error } from "console";

declare module 'react' {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        // extends React's HTMLAttributes
        directory?: string;
        webkitdirectory?: string;
        mozdirectory?: string;
    }
}

class ValidationMessage {
    affectedText: string = "";
    line: number = -1;
    fileName: string = "";
    
    constructor(affectedText: string, line: number, fileName: string) {
        this.affectedText = affectedText;
        this.line = line;
        this.fileName = fileName;
    }
}

class LintResult {
    pass: number = 0;
    fail: number = 0;

    evaluation() {
        if (this.pass === 0 && this.fail === 0) {
            return "N/A";
        }
        else if (this.fail === 0 && this.pass > 0) {
            return "all ES6 syntax";
        }
        else if (this.fail > 0 && this.fail === 0) {
            return "only outdated syntax";
        }
        else {
            return `Mixed: ${this.pass} ES6; ${this.fail} outdated. Use judgement!`;
        }
    }
}

const convertToHTML = (fileContents: string) => {
    const parser = new DOMParser();
    return parser.parseFromString(fileContents, "text/html");
}


const readAndCheckJS = (file: File,
    fileMap: Map<string, string>,
    errorMap: Map<string, LintResult>, // ES6 issue with list of affected files
    parseErrorArr: Array<string>
) => {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onerror = e => {
            parseErrorArr.push(file.webkitRelativePath);
            reject(`Unable to read ${file.webkitRelativePath}`);
        }

        fileReader.onloadend = e => {
            if (typeof fileReader.result === "string") {
                fileMap.set(file.webkitRelativePath, fileReader.result);
                
                for (const rule of rules) {
                    if (!errorMap.has(rule.description)) {
                        errorMap.set(rule.description, new LintResult());
                    }
                    // regex test
                    for (const match of fileReader.result.matchAll(rule.regexPass)) {
                        const item = errorMap.get(rule.description);
                        if (item) {
                            console.log("PASS", rule.description, file.webkitRelativePath);
                            item.pass++;
                        }
                    }
                    for (const match of fileReader.result.matchAll(rule.regexFail)) {
                        const item = errorMap.get(rule.description);
                        if (item) {
                            console.log("FAIL", rule.description, file.webkitRelativePath);
                            item.fail++;
                        }
                    }
                    console.log(rule.description, "passed", errorMap.get(rule.description)?.pass, "failed", errorMap.get(rule.description)?.fail);
                    // Map key = description, { fail: x, pass: y}
                }
                resolve(`Validated ${file.webkitRelativePath}`);
            } else {
                console.log("Oops file is a", typeof fileReader.result);
                reject(`Unable to read ${file.webkitRelativePath}`);
            }
        }

        fileReader.readAsText(file);
    });
    
}


const readAndValidateHTML = (file: File,
                             fileMap: Map<string, Document>, 
                             errorMap: Map<string, Array<ValidationMessage>>, 
                             warningMap: Map<string, Array<ValidationMessage>>,
                             parseErrorArr: Array<string>) => {
    const API = 'https://validator.w3.org/nu/?out=json'
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onerror = (e) => {
            parseErrorArr.push(file.webkitRelativePath);
            reject(`Unable to read ${file.webkitRelativePath}`);
        }

        fileReader.onloadend = () => {
            if (typeof fileReader.result === "string") {
                fileMap.set(file.webkitRelativePath, convertToHTML(fileReader.result));
            } else {
                fileMap.set(file.webkitRelativePath, new Document());
            }
            fetch(API, {
                 method: "POST",
                 headers: {
                    "Content-Type": "text/html; charset=UTF-8",
                 },
                 body: file
            }).then(res => res.json()).then(data =>{
                if (data.hasOwnProperty("messages")) {
                    for (const message of data.messages) {
                        const valMessage = new ValidationMessage(message.extract, message.lastLine, file.name);
                        if (message.type === "error") {
                            if (!errorMap.has(message.message)) {
                                errorMap.set(message.message, []);
                            }
                            errorMap.get(message.message)?.push(valMessage);
                        } else if (message.type === "info") {
                            if (!warningMap.has(message.message)) {
                                warningMap.set(message.message, []);
                            }
                            warningMap.get(message.message)?.push(valMessage);
                        } else {
                            parseErrorArr.push(file.webkitRelativePath);
                        }
                    }
                }
                resolve(`Validated ${file.webkitRelativePath}`);
            })
            .catch(e => {
                reject(`Error parsing ${file.webkitRelativePath}: ${e}`);
            });
            
        }

        fileReader.readAsText(file);
    });
    
}


const checkIndex = (fileNames: Map<string, Document>) => {
    for (const name of fileNames.keys()) {
        if (name.toLowerCase().endsWith("/index.html")) {
            return <li>PASS: project has an index.html</li>;
        }
    }
    return <li>FAIL: project does not have an index.html</li>;
}


export default function Home() {
    const [selectedFolder, setSelectedFolder] = useState<string>("No submission selected");
    const [allHTML, setAllHTML] = useState<Map<string, Document>>(new Map());
    const [htmlErrors, setHtmlErrors] = useState<Map<string, Array<ValidationMessage>>>(new Map());
    const [jsErrors, setJsErrors] = useState<Map<string, LintResult>>(new Map());
    const [parseErrors, setParseErrors] = useState<Array<string>>([]);
    const [allJS, setAllJS] = useState<Map<string, string>>(new Map());

    const processUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            if (e.target.files.length > 0) {
                const folder = e.target.files[0].webkitRelativePath.substring(0, e.target.files[0].webkitRelativePath.indexOf("/"));
                const html = new Map<string, Document>();
                const js = new Map<string, string>();
                const tempHtmlErrors = new Map();
                const tempHtmlWarnings = new Map();
                const tempJsErrors = new Map();
                const tempParseErrors: string[] = [];
                const promises = [];
                for (const file of Array.from(e.target.files)) {
                    if (file.name.toLowerCase().endsWith(".html")) {
                        promises.push(readAndValidateHTML(file, html, tempHtmlErrors, tempHtmlWarnings, tempParseErrors))
                    }
                    if (file.name.toLowerCase().endsWith(".js")) {
                        promises.push(readAndCheckJS(file, js, tempJsErrors, tempParseErrors));
                    }

                }
                Promise.all(promises).then((results) => {
                    for (const res of results) {
                        console.log(res);
                    }
                    setSelectedFolder(folder);
                    setAllHTML(html);
                    setAllJS(js);
                    setHtmlErrors(tempHtmlErrors);
                    setParseErrors(tempParseErrors);
                    setJsErrors(tempJsErrors);
                })
            }
        }
    }

    const checkAllImages = () => {
        let imageTotal = 0;
        let imagesWithAlt = 0;
        let imagesWithEmptyAlt = 0;
        for (const [path, htmlFile] of allHTML) {
            const allImages = Array.from(document.getElementsByTagName("img"));
            imageTotal += allImages.length;
            for (const img of allImages) {
                const alt = img.getAttribute("alt");
                if (alt !== null) {
                    if (alt.length > 0) {
                        imagesWithAlt++;
                    } else {
                        imagesWithEmptyAlt++;
                    }
                }
            }
        }
        if (imagesWithAlt === imageTotal) {
            return <li>PASS: All images have alt attributes that contain text - check they are also meaningful!</li>
        } else {
            return <li>FAIL: {`${imagesWithEmptyAlt} of ${imageTotal} images have empty alt attributes. ${imageTotal - imagesWithEmptyAlt - imagesWithAlt} of ${imageTotal} images have no alt attribute.`}</li>
        }
    }

    return (
        <main className={styles.main}>
            
            <h1>{selectedFolder}</h1>
            {/** Upload a folder */}
            <label htmlFor="file-upload">Choose a submission (should be the folder that contains the student&apos;s HTML and JS)</label>
            <input id="file-upload" type="file" name="file upload" onChange={processUpload} directory="" webkitdirectory="" mozdirectory=""/>
            {
                parseErrors.length > 0 &&
                    <>
                        <h2>Validator parsing errors:</h2>
                        <ul>
                        {
                            parseErrors.map((fileName, i) => <li key={i}>{fileName}</li>)
                        }
                        </ul>
                    </>
            }
            {
                allHTML.size > 0 &&
                    <>
                        <h2>HTML validation results:</h2>
                        <p>HTML files checked: {Array.from(allHTML.keys()).join(", ")}</p>
                        {
                            htmlErrors.size === 0 ?
                                <p>No HTML validation errors found.</p>
                                :
                                <>
                                    <h3>Errors</h3>
                                    <ul>
                                        {
                                            Array.from(htmlErrors.entries()).map((entry, i) => 
                                                <li key={i}>{entry[0]}
                                                    <ul>
                                                        {
                                                        entry[1].map((msg, u) => 
                                                            <li key={u}>{msg.fileName}, line number {msg.line}: <code>{msg.affectedText}</code></li>
                                                        )
                                                        }
                                                    </ul>
                                                </li>
                                            )
                                        }
                                    </ul>
                                </>
                        }
                        <h3>Custom checks</h3>
                        { checkIndex(allHTML) }
                        { checkAllImages() }
                    </>
            }
            {
                allJS.size > 0 &&
                    <>
                        <h2>JS ES6 syntax check results:</h2>
                        <p>JS files checked: {Array.from(allJS.keys()).join(", ")}</p>
                        {
                            jsErrors.size === 0 ?
                                <p>No JS checks performed.</p>
                                :
                                <>
                                    <h3>Syntax check results</h3>
                                    <ul>
                                        {
                                            Array.from(jsErrors.entries()).map((entry, i) => 
                                                <li key={i}>{entry[0]}
                                                    <ul>
                                                        <li>{entry[1].evaluation()}</li>
                                                    </ul>
                                                </li>
                                            )
                                        }
                                    </ul>
                                </>
                        }
                    </>
            }
        </main>
    );
}
