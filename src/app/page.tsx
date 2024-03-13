"use client"
import { useState } from "react";
import styles from "./page.module.css";

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

const readAndValidateHTML = (file: File, 
                             errorMap: Map<string, Array<ValidationMessage>>, 
                             warningMap: Map<string, Array<ValidationMessage>>,
                             parseErrorArr: Array<string>) => {
    const API = 'https://validator.w3.org/nu/?out=json'
    return fetch(API, {
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
    })
    .catch(e => {
        console.log(`Error parsing ${file.webkitRelativePath}: ${e}`);
    });
}

/**
 * no error > id="congrats"
 * <tr class="error">
                            <td class="linenumber" title="Line 1">1</td>
                            <td class="codeContext"> .body </td>
                            <td class="parse-error">
                                Property <code>madeup</code> doesn&#39;t exist : 
                                <span class="exp">
                                    0
                                </span>
                            </td>
                        </tr>
 */

const readAndValidateCSS = (file: File, 
        errorMap: Map<string, Array<ValidationMessage>>, 
        warningMap: Map<string, Array<ValidationMessage>>,
        parseErrorArr: Array<string>) => {
    const apiBase = 'https://jigsaw.w3.org/css-validator/validator'
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onerror = (e) => {
            parseErrorArr.push(file.webkitRelativePath);
            reject(`Unable to read ${file.webkitRelativePath}`);
        }

        fileReader.onloadend = () => {
            console.log("Read", fileReader.result);
            fetch(`${apiBase}?text=${fileReader.result}`).then(res => res.text()).then(data => {
                const domParser = new DOMParser();
                const response = domParser.parseFromString(data, "text/html");
                const errors = Array.from(response.getElementsByClassName("error"));
                for (const row of errors) {
                    const cells = Array.from(row.getElementsByTagName("td"));
                    // linenumber, codeContext, parse-error
                    let line = -1;
                    let context = "";
                    let message = "";
                    for (const cell of cells) {
                        switch (cell.className) {
                            case "linenumber":
                                line = parseInt(cell.innerText);
                                break;
                            case "codeContext":
                                context = cell.innerHTML;
                                break;
                            case "parse-error":
                                message = cell.innerHTML;
                                break;
                        }
                    }
                    const validation = new ValidationMessage(context, line, file.webkitRelativePath);
                    if (!errorMap.has(message)) {
                        errorMap.set(message, []);
                    }
                    errorMap.get(message)?.push(validation);
                }
                console.log(response);
                resolve(`Read ${file.webkitRelativePath}`);
            }).catch(e => {
                parseErrorArr.push(file.webkitRelativePath);
                console.log(e);
                reject(`Error validating ${file.webkitRelativePath}`);
            })
            
        }

        fileReader.readAsText(file);
    });

}

export default function Home() {
    const [selectedFolder, setSelectedFolder] = useState<string>("No submission selected");
    // Remove these eventually
    const [allHTML, setAllHTML] = useState<Map<string, string>>(new Map());
    const [allCSS, setAllCSS] = useState<Map<string, string>>(new Map());
    // New approach
    const [htmlErrors, setHtmlErrors] = useState<Map<string, Array<ValidationMessage>>>(new Map());
    const [htmlInfo, setHtmlInfo] = useState<Map<string, Array<ValidationMessage>>>(new Map());
    const [cssErrors, setCssErrors] = useState<Map<string, Array<ValidationMessage>>>(new Map());
    const [cssInfo, setCssInfo] = useState<Map<string, Array<ValidationMessage>>>(new Map());
    const [parseErrors, setParseErrors] = useState<Array<string>>([]);

    const processUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            if (e.target.files.length > 0) {
                const folder = e.target.files[0].webkitRelativePath.substring(0, e.target.files[0].webkitRelativePath.indexOf("/"));
                const html = new Map();
                const css = new Map();
                const tempHtmlErrors = new Map();
                const tempHtmlWarnings = new Map();
                const tempParseErrors: string[] = [];
                const tempCssErrors = new Map();
                const tempCssWarnings = new Map();
                for (const file of Array.from(e.target.files)) {
                    if (file.name.toLowerCase().endsWith(".html")) {
                        html.set(file.name, file);
                    }
                    else if (file.name.toLowerCase().endsWith(".css")) {
                        css.set(file.name, file);
                    }
                }
                // setSelectedFolder(folder);
                // setAllHTML(html);
                // setAllCSS(css);
                const promises = [];
                for (const file of Array.from(e.target.files)) {
                    if (file.name.toLowerCase().endsWith(".html")) {
                        promises.push(readAndValidateHTML(file, tempHtmlErrors, tempHtmlWarnings, tempParseErrors))
                        // promises.push(readAndValidate('https://validator.w3.org/nu/', file, new Map(), new Map()))
                        // promises.push(readAndStoreContents(file, html));
                    }
                    else if (file.name.toLowerCase().endsWith(".css")) {
                        promises.push(readAndValidateCSS(file, tempCssErrors, tempCssWarnings, tempParseErrors))
                        // promises.push(readAndStoreContents(file, css));
                    }
                }
                Promise.all(promises).then((results) => {
                    for (const res of results) {
                        console.log(res);
                    }
                    setSelectedFolder(folder);
                    // Old - replace eventually
                    setAllHTML(html);
                    setAllCSS(css)
                    // New
                    setHtmlErrors(tempHtmlErrors);
                    setHtmlInfo(tempHtmlWarnings);
                    setCssErrors(tempCssErrors);
                    setParseErrors(tempParseErrors);
                })
            }
        }
    }

    return (
        <main className={styles.main}>
            <h1>{selectedFolder}</h1>
            {/** Upload a folder */}
            <label htmlFor="file-upload">Choose a submission (should be the folder the contains the student&apos;s HTML and CSS)</label>
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
                        <p>HTML files found: {Array.from(allHTML.keys()).join(", ")}</p>
                        <h2>HTML validation results:</h2>
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
                        {
                            htmlInfo.size === 0 ?
                                <p>No HTML validation warnings found.</p>
                                :
                                <>
                                    <h3>Warnings</h3>
                                    <ul>
                                        {
                                            Array.from(htmlInfo.entries()).map((entry, i) => 
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
                    </>
            }
            {
                allCSS.size > 0 &&
                    <>
                        <p>CSS files found: {Array.from(allCSS.keys()).join(", ")}</p>
                        <h2>CSS validation results:</h2>
                        {
                            cssErrors.size === 0 ?
                                <p>No CSS validation errors found.</p>
                                :
                                <>
                                    <h3>Errors</h3>
                                    <ul>
                                        {
                                            Array.from(cssErrors.entries()).map((entry, i) => 
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
                    </>
            }
            {/** Validate HTML and CSS */}
            {/** Parse for common issues? */}
        </main>
    );
}
