const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const tailwind = require('tailwindcss');
const postcssPresetEnv = require('postcss-preset-env');

const postcssPlugins = [
    postcssPresetEnv({ stage: 0, autoprefixer: false }),
    tailwind('./tailwind.config.js'),
];

module.exports = {
    siteName: 'Goulven CLEC\'H - Portfolio',
    siteDescription: "I'm a 22 yo web developer and designer, based in Toulouse, France.",
    siteUrl: 'https://goulven-clech.dev',
    titleTemplate: '<siteName>',
    chainWebpack: (config) => {
        if (process.env.NODE_ENV !== 'production') {
            config
                .plugin('BundleAnalyzerPlugin')
                .use(BundleAnalyzerPlugin, [{ analyzerMode: 'static', openAnalyzer: false }]);
        }
    },
    css: {
        loaderOptions: {
            postcss: {
                plugins: postcssPlugins,
            },
        },
    },
    templates: {
        Work: '/work/:slug',
    },

    plugins: [
        {
        // Create posts from markdown files
            use: '@gridsome/source-filesystem',
            options: {
                typeName: 'Work',
                path: 'content/works/*.md',
            },
        },
    ],
};
