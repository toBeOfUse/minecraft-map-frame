// from https://stackoverflow.com/a/60402866
module.exports = {
    chainWebpack: config => {
        config
            .plugin('html')
            .tap(args => {
                args[0].title = 'everything the light touches'
                return args
            })
    }
}