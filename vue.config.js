const path = require("path");
const CircularDependencyPlugin = require('circular-dependency-plugin');
module.exports = {
    outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, "./dist"),
    configureWebpack: {
        plugins: [new CircularDependencyPlugin()]
    },
    chainWebpack: config => {
        config
            .plugin('html')
            .tap(args => {
                args[0].title = 'everything the light touches'
                return args
            })
    }
}
