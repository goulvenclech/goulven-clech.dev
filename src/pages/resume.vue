<template>
    <Layout>
        <div class="max-w-content mx-auto">
            <div class="w-full flex flex-wrap overflow-hidden">
                <h2 class="text-font my-24 sm:my-32 flex-auto">
                    FrontEnd application developer
                </h2>
                <g-image src="../assets/profilepicture.png"
                         class="flex"
                />
            </div>
            <div class="content max-w-post mx-auto">
                <p>22 years old, based in Toulouse, France. I specialize myself in the JavaScript ecosystem and the VueJS and React frameworks. I'm used to working with Git, Webpack, NPM and many organizational tools (Github Project, Trello, Lint, etc.).</p>
                <p>Currently in training "application developer" (RNCP27099) at OpenClassrooms, I am looking for a work-study contract (4 days in business, 1 day in training per week) for 24 months.</p>
                <h3>My experiences</h3>
                <ul class="list-disc list-inside leading-normal text-xl font-body">
                    <li><strong>Apprentice at Openclassroom, 2020 - present</strong>:<br /> Skills taught as part of the "<a href="https://openclassrooms.com/fr/paths/60-developpeur-dapplication-frontend">Application Developer - FrontEnd</a>" training: JavaScript, Jquery, UML, Wordpress, BootStrap, API Rest, Git, GitHub, mock-up integration, technology watch, specification compliance, interfaces creation...</li>
                    <li><strong>Co-founder of Game Dev Alliance, 2018 - present</strong>:<br /> One of the largest communities of amateur game developers in France. Creation of several websites (<a href="/work/fairedesjeux">here</a>, <a href="/work/gamedevalliance">here</a> and <a href="/work/gamedevalliance-next">here</a>), management of a <a href="https://wiki.gamedevalliance.fr">wiki website</a> and a <a href="https://www.youtube.com/user/FoxFiesta40">Youtube channel</a>. VueJS (Gridsome) and Git (Github) training.</li>
                    <li><strong>Freelance Web Developer, 2018 - 2020</strong>:<br /> Creation of several static websites (like <a href="https://fil-agape.org/">this one</a>). And training in modern web technologies.</li>
                    <li><strong>Administrative assistant for Oxbridge Academics Programs, July 2019</strong>:<br /> Management of the <a href="https://oxbridgeacademicprograms.wordpress.com/">program blog</a>, as well as various administrative tasks.</li>
                    <li><strong>Other experiences</strong>:<br /> Three years of sociology studies. 8 months in a health prevention association. Several months of various jobs. Technological baccalaureate (STI2D).</li>
                </ul>
                <h3>My hobbies</h3>
                <p>I am very interested in the technologies of the future (SvelteJS, Crystal, Rust) and the OpenSource community (Linux user since high school). I am also passionate about clothing, cooking, science fiction... Finally, I love making little video games on my square time, passion that I share on <a href="https://gamedevalliance.fr">Game Dev Alliance</a> !</p>
            </div>
        </div>
    </Layout>
</template>

<style lang="postcss">
    img {
        @apply object-top object-cover w-150 h-150 rounded-lg my-4;
    }
    .content {
        &li {
            @apply my-4;
        }
    }
</style>
