module.exports = {
    root: true,
    env: {
        es6: true, // Enable ES6 globals
        node: true, // Enable Node.js global variables and Node.js scoping.
    },
    extends: [
        "eslint:recommended", // Use ESLint recommended rules
        "google", // Use Google's JS style guide rules (common for Firebase Functions)
    ],
    parserOptions: {
        ecmaVersion: 2020, // <--- Set to 2020 or higher to support optional chaining etc.
    },
    rules: {
        "quotes": ["error", "double"], // Enforce double quotes
        "require-jsdoc": 0, // Don't require JSDoc comments
        "valid-jsdoc": 0, // Don't validate JSDoc comments
        "object-curly-spacing": ["error", "always"], // Enforce space inside braces
        "indent": ["error", 4], // Enforce 4-space indentation
        "max-len": ["error", { "code": 120 }], // Allow longer lines
    },
};
