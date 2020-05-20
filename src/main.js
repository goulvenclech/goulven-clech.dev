// Tailwind
import './assets/global.css';
import 'tailwindcss/tailwind.css';

// Fonts
import 'typeface-source-code-pro';
import 'typeface-source-sans-pro';
import 'typeface-muli';


// Font-Awesome
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { config, library } from '@fortawesome/fontawesome-svg-core';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

import '@fortawesome/fontawesome-svg-core/styles.css';

// Default layout
import Layout from './layouts/Default.vue';

// Font-Awesome import icons
config.autoAddCss = false;
library.add(faGithub, faPaperPlane);

export default function (Vue) {
    Vue.component('Layout', Layout);
    Vue.component('font-awesome', FontAwesomeIcon);
}
