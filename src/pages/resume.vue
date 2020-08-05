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
                        Je m'appelle Goulven CLEC'H, j'ai 22 ans et suis Toulousain. Actuellement en formation chez
                        OpenClassrooms comme Développeur d'application Front End, je suis à la recherche d'une
                        alternance en contrat pro (4 jours par semaine en entreprise, 1 jour en formation).
                    </p>
                    <p>
                        Avec des amis, j’ai co-fondé l’association Game Dev Alliance, devenue une des plus grosses
                        communautés de créateurs de jeux vidéos en France. Mais je me passionne également pour les
                        vêtements (notamment vintage), la cuisine végétarienne et les enjeux écologiques.
                    </p>
                </div>
            </div>
        </div>
        <!-- Mon CV -->
        <div class="max-w-content mx-auto p-2">
            <h2>Mes expériences</h2>
            <ul class="skills list-disc list-inside leading-normal text-base font-body">
                <li>
                    <strong>Etudiant chez OpenClassrooms, 2020 - présent</strong>:<br />
                    Compétences enseignées durant la formation "
                    <a href="https://openclassrooms.com/fr/paths/60-developpeur-dapplication-frontend">
                        Développeur d'application - Front End
                    </a>
                    " : JavaScript, Jquery, UML, Wordpress, BootStrap, API Rest, Git, GitHub, mock-up integration,
                    veille technologique, création d'interface...
                </li>
                <li>
                    <strong>Co-fondateur de Game Dev Alliance, 2018 - présent</strong>:<br />
                    Une des plus grosses communautés de créateurs de jeux vidéos en France. Création de
                    plusieurs sites web (<a href="/work/fairedesjeux">Ici</a>,
                    <a href="/work/gamedevalliance"> là</a> et <a href="/work/gamedevalliance-next">là</a>),
                    modération d'un <a href="https://wiki.gamedevalliance.fr">wiki</a> et d'une
                    <a href="https://www.youtube.com/user/FoxFiesta40">chaîne Youtube</a> (pour laquelle j'écris aussi).
                    Formation à VueJS (Gridsome) et à Git (Github).
                </li>
                <li>
                    <strong>Développeur Web en Freelance, 2018 - 2020</strong>:<br />
                    Création de plusieurs sites statiques (comme <a href="https://fil-agape.org/">celui-ci</a>).
                    Et formation aux technologies Web.
                </li>
                <li>
                    <strong>Assistant administratif pour Oxbridge Academics Programs, juillet 2019</strong>:<br />
                    Gestion du <a href="https://oxbridgeacademicprograms.wordpress.com/">blog Wordpress</a>, ainsi
                    que différentes tâches administratives. Anglais professionnel.
                </li>
                <li>
                    <strong>Autres expériences</strong>:<br /> Trois ans d'études en sociologie.
                    8 mois dans une association de prévention santé. Plusieurs petits boulots. Bac technologique (STI2D).
                </li>
            </ul>
        </div>
        <!-- Ma présentation vidéo -->
        <div class="max-w-content mx-auto p-2">
            <h2>Présentation vidéo</h2>
            <p>En cours de réalisation...</p>
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
