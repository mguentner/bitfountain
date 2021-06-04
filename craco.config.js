const { loaderByName, addBeforeLoader } = require('@craco/craco');

module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            webpackConfig.resolve.extensions.push('.md');

            const mdRule = {
                test: /\.md$/,
                exclude: /node_modules/,
                use: [
                  {
                    loader: "html-loader",
                  },
                  {
                    loader: require.resolve('markdown-loader'),
                    options: {
                      // see <https://marked.js.org/using_advanced#options>
                    },
                  },
                ],
            };

            addBeforeLoader(webpackConfig, loaderByName('file-loader'), mdRule);

            return webpackConfig;
        },
    },
};