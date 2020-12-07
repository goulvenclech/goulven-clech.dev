<template>
    <Layout>
        <!-- Présentation -->
        <div class="bg-area-2 w-full">
            <div class="max-w-content mx-auto p-2">
                <h2>A propos de moi</h2>
                <img src="../assets/profilepicture.png"
                     width="160"
                     class="ml-3 mr-0 mt-0 mb-3 rounded-lg float-right"
                />
                <div class="">
                    <p>
                        Je m'appelle Goulven CLEC'H, 23 ans et toulousain, je travaille actuellement comme développeur
                        full stack chez <a href="https://encheres-immo.com/">Enchères-Immo</a> en alternance avec
                        <a href="https://openclassrooms.com/fr/paths/314-developpeur-front-end">OpenClassrooms</a>.
                    </p>
                    <p>
                        Avec des amis, j’ai co-fondé l’association Game Dev Alliance, devenue l'une des plus grosses
                        communautés de créateurs de jeux vidéos en France. Mais je suis également passionné par les
                        fringues vintages, la cuisine végétarienne et les enjeux écologiques.
                    </p>
                    <p>
                        Retrouvez moi sur <a href="https://github.com/GoulvenC">GitHub</a>,
                        <a href="https://twitter.com/GoulvenClech">Twitter</a> et
                        <a href="https://www.linkedin.com/in/goulvenc/">LinkedIn</a>.
                    </p>
                    </a>
                    </p></a>
                </div>
            </div>
        </div>
        <!-- Mon Mes expériences -->
        <div class="max-w-content mx-auto p-2">
            <h2>Mes expériences</h2>
            <p>
                <strong>Etudiant chez OpenClassrooms, 2020 - présent</strong>:<br />
                Compétences enseignées durant la formation "
                <a href="https://openclassrooms.com/fr/paths/60-developpeur-dapplication-frontend">
                    Développeur d'application - Front End
                </a>
                " : JavaScript, jQuery, UML, WordPress, Bootstrap, API REST, Git, GitHub, mock-up integration,
                veille technologique, création d'interface...
            </p>
            <p>
                <strong>Co-fondateur de Game Dev Alliance, 2018 - présent</strong>:<br />
                Une des plus grosses communautés de créateurs de jeux vidéos en France. Création de
                plusieurs sites web (<a href="/work/fairedesjeux">Ici</a>,
                <a href="/work/gamedevalliance"> là</a> et <a href="/work/gamedevalliance-next">là</a>),
                modération d'un <a href="https://wiki.gamedevalliance.fr">wiki</a> et d'une
                <a href="https://www.youtube.com/user/FoxFiesta40">chaîne YouTube</a> (pour laquelle j'écris aussi).
                Formation à VueJS (Gridsome) et à Git (GitHub).
            </p>
            <p>
                <strong>Développeur Web en Freelance, 2018 - 2020</strong>:<br />
                Création de plusieurs sites statiques (comme <a href="https://fil-agape.org/">celui-ci</a>).
                Et formation aux technologies Web.
            </p>
            <p>
                <strong>Assistant administratif pour Oxbridge Academics Programs, juillet 2019</strong>:<br />
                Gestion du <a href="https://oxbridgeacademicprograms.wordpress.com/">blog WordPress</a>, ainsi
                que différentes tâches administratives. Anglais professionnel.
            </p>
            <p>
                <strong>Autres expériences</strong>:<br /> Trois ans d'études en sociologie.
                8 mois dans une association de prévention santé. Plusieurs petits boulots. Bac technologique (STI2D).
            </p>
        </div>
        <!-- Mon CV -->
        <div class="max-w-content mx-auto p-2">
            <h2>Mon CV</h2>
            <p>
                <a href="/CV-CLECH-2020.pdf">
                    Télécharger en PDF
                </a>
            </p>
        </div>
    </Layout>
</template>

<style lang="postcss">
    .profile {
        @apply object-top object-cover w-150 h-150 rounded-lg my-4;
    }

    .skills {
        & li {
            @apply my-4;
        }
    }
</style>
