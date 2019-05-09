const path = require("path");
const WebpackBuildNotifierPlugin = require('webpack-build-notifier');

module.exports = {
    devServer: {
        contentBase: path.join(__dirname, 'public'),
        proxy: {
            '/api': 'http://localhost:9004'
        },
        overlay: false
    },
    entry: './app/main.ts',
    output: {
        filename: 'bundle.js',
        publicPath: '/dist/',
        path: path.join(__dirname, '/public/dist')
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: [/node_modules/],
                loader: 'awesome-typescript-loader'
            },
            {
                test: /\.css$/,
                loaders: ['style-loader', 'css-loader']
            },
            {
                test: /\.html$/,
                loader: 'raw-loader',
                exclude: [/node_modules/]
            },
            {
                test: /\.(png|jpg|jpeg|gif|svg|woff|woff2)$/,
                loader: 'url-loader?limit=10000',
            },
            {
                test: /\.(eot|ttf|wav|mp3)$/,
                loader: 'file-loader',
            },
            {
                test: /\.json$/,
                loader: 'json-loader'
            },
            {
                test: require.resolve('jquery'),
                use: [{
                    loader: 'expose-loader',
                    options: 'jQuery'
                }, {
                    loader: 'expose-loader',
                    options: '$'
                }]
            }
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },
    plugins: [
        new WebpackBuildNotifierPlugin({
            title: "My Project Webpack Build",
            logo: path.resolve("./img/favicon.png"),
            suppressSuccess: true
        })
    ]
};
