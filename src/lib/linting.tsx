// Regular expressions to check == and var
const eqeqeq = /[^!=]((!|=)=)[^=]/g;
const eqeqeqCorrect = /[^!=](!|=)==[^=]/g;
const novar = /\bvar\b/g;
const novarCorrect = /\b(let|const)\b/g;

export const rules = [
    {
        regexFail: eqeqeq,
        regexPass: eqeqeqCorrect,
        description: "Equality / inequality comparisons use the strict operators: instead of == use === and instead of != use !==."
    },
    {
        regexFail: novar,
        regexPass: novarCorrect,
        description: "Variables are declared using let or const and not the outdated var keyword."
    }
]