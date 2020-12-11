<template>
    <Layout>
        <!-- Présentation -->
        <div class="bg-area-2 w-full">
            <div class="max-w-content mx-auto p-2">
                <!-- Ici, j'importe l'animation avec mes compétences depuis un composant -->
                <h2>Développeur <Skills /></h2>
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
                    <p><a href="/resume">En savoir plus</a></p>
                </div>
            </div>
        </div>
        <!-- Dernier travaux -->
        <div class="max-w-content mx-auto p-2">
            <h2>Mon portfolio</h2>
            <g-link v-for="work in $page.works.edges"
                    :key="work.weight"
                    :to="work.node.path"
            >
                <!-- Il faut que je pense à réduire ce bloc de code en important directement la valeur
                     de la couleur du fond mais en évitant qu'elle soit purge par purgecss en ajoutant
                     toutes les variantes possibles dans la whitelist du fichier de config  -->
                <div v-if="work.node.color === 'primary'"
                     class="bg-primary w-full h-featuredClass my-4 rounded-lg hotspot"
                >
                    <g-image :src="work.node.image"
                             :alt="work.node.title"
                             class="object-top object-cover w-700 mx-auto illu relative"
                    />
                </div>
                <div v-else-if="work.node.color === 'secondary'"
                     class="bg-secondary w-full h-featuredClass my-4 rounded-lg hotspot"
                >
                    <g-image :src="work.node.image"
                             :alt="work.node.title"
                             class="object-top object-cover w-700 mx-auto illu relative"
                    />
                </div>
                <div v-else-if="work.node.color === 'area'"
                     class="bg-tertiary w-full h-featuredClass my-4 rounded-lg hotspot"
                >
                    <g-image :src="work.node.image"
                             :alt="work.node.title"
                             class="object-top object-cover w-700 mx-auto illu relative"
                    />
                </div>
            </g-link>
        </div>
        <!-- Blog -->
        <div class="bg-area-2 w-full">
            <div class="max-w-content mx-auto p-2">
                <h2>Mes derniers articles</h2>
                <div class="flex flex-wrap -mx-2">
                    <div v-for="article in $page.articles.edges"
                         :key="article.date"
                         class="w-full sm:w-1/2 px-2"
                    >
                        <g-link :to="article.node.path">
                            <g-image
                                :src="article.node.image"
                                class="h-150 mt-0 object-cover opacity-100 hover:opacity-50 duration-300"
                                alt="Image de couverture"
                            />
                        </g-link>
                        <h3 class="mt-4">
                            <g-link :to="article.node.path"
                                    class="text-font shadow-none hover:shadow-none hover:text-font"
                            >
                                {{ article.node.title }}
                            </g-link>
                        </h3>
                        <p>
                            {{ article.node.description }}
                        </p>
                        <p>
                            <g-link :to="article.node.path">
                                Lire la suite.
                            </g-link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </Layout>
</template>

<script>
    import Skills from './components/Skills.vue';

    export default {
        components: {
            Skills,
        },
    };
</script>

<style lang="postcss">
    .maintitle::before {
        border: none;
    }

    .illu {
        top: 4rem;
        height: 15rem;
        box-shadow: 10px -10px 16px rgba(0, 0, 0, 0.3);
        border-radius: 10px 10px 0 0;
        transition: 0.2s ease-in-out;
    }

    .hotspot:hover .illu {
        top: 1rem;
        height: 18rem;
        width: 75%;
        transition: 0.2s ease-in-out;
    }
</style>

<page-query>
query {
    works: allWork(sortBy: "weight", order: ASC) {
        edges {
            node {
                title
                color
                image
                path
                weight
            }
        }
    }
    articles: allArticle(sortBy: "date", order: DESC) {
        edges {
            node {
                title
                date
                description
                image
                path
            }
        }
    }
}
</page-query>
