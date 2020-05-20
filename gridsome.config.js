const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const purgecss = require('@fullhuman/postcss-purgecss');
const tailwind = require('tailwindcss');
const postcssPresetEnv = require('postcss-preset-env');

const postcssPlugins = [
    postcssPresetEnv({ stage: 0, autoprefixer: false }),
    tailwind('./tailwind.config.js'),
];

if (process.env.NODE_ENV === 'production') postcssPlugins.push(purgecss());

module.exports = {
    siteName: 'Goulven CLEC\'H - Web developer & designer',
    siteUrl: 'https://goulven-clech.dev',
    chainWebpack: (config) => {
        if (process.env.NODE_ENV !== 'production') {
            config
                .plugin('BundleAnalyzerPlugin')
                .use(BundleAnalyzerPlugin, [{ analyzerMode: 'static', openAnalyzer: false }]);
            config.module
                .rule('postcss-loader')
                .test(/.css$/)
                .use(['tailwindcss', 'autoprefixer'])
                .loader('postcss-loader');
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
