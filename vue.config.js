const path = require("path");
module.exports = {
    outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, "./dist"),
    chainWebpack: config => {
        config
            .plugin('html')
            .tap(args => {
                args[0].title = 'everything the light touches'
                return args
            })
    }
}