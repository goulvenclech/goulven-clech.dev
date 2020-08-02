<template>
    <Layout>
        <!-- Présentation -->
        <div class="bg-area-2 w-full">
            <div class="max-w-content mx-auto p-2">
                <h2>Développeur <Skills /></h2>
                <img src="../assets/profilepicture.png"
                     class="w-75 h-75 ml-3 mr-0 mt-0 mb-3 rounded-lg float-right"
                />
                <div class="">
                    <p>
                        Goulven CLEC'H, 22 ans et Toulousain. Actuellement en formation chez OpenClassrooms comme Dévéloppeur d'application Front END, je suis à la recherche d'une alternance en contrat pro (4 jours par semaine en entreprise, 1 jour en formation).
                    </p>
                    <p>
                        Sur ce Github, vous pourrez également suivre mon travail avec Game Dev Alliance, une des plus grosses communautés de créateurs de jeux vidéos amateurs en France, que j'ai co-fondé avec des amis. Vous pouvez nous retrouver sur le site officiel, le wiki, la chaîne Youtube et notre serveur Discord !
                    </p>
                    <p><a>En savoir plus</a></p>
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
                <div v-if="work.node.color === 'primary'"
                     class="bg-primary w-full h-featuredClass my-4 rounded-lg hotspot"
                >
                    <g-image :src="work.node.image"
                             :alt="work.node.title"
                             class="object-top object-cover w-700 mx-auto illu relative rounded-lg"
                    />
                </div>
                <div v-else-if="work.node.color === 'secondary'"
                     class="bg-secondary w-full h-featuredClass my-4 rounded-lg hotspot"
                >
                    <g-image :src="work.node.image"
                             :alt="work.node.title"
                             class="object-top object-cover w-700 mx-auto illu relative rounded-lg"
                    />
                </div>
                <div v-else-if="work.node.color === 'area'"
                     class="bg-active w-full h-featuredClass my-4 rounded-lg hotspot"
                >
                    <g-image :src="work.node.image"
                             :alt="work.node.title"
                             class="object-top object-cover w-700 mx-auto illu relative rounded-lg"
                    />
                </div>
            </g-link>
        </div>
        <!-- Blog -->
        <div class="bg-area-2 w-full">
            <div class="max-w-content mx-auto p-2">
                <h2>Mes derniers articles</h2>
                <div class="flex flex-wrap -mx-2">
                    <div class="w-1/2 px-2">
                        <div class="h-150 bg-primary rounded-lg">
                        </div>
                        <h3 class="mt-4">
                            Ceci est un test
                        </h3>
                        <p>
                            Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
                            </br>
                            <a>Lire la suite.</a>
                        </p>
                    </div>
                    <div class="w-1/2 px-2">
                        <div class="h-150 bg-secondary rounded-lg">
                        </div>
                        <h3 class="mt-4">
                            Ceci est un test
                        </h3>
                        <p>
                            Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
                            </br>
                            <a>Lire la suite.</a>
                        </p>
                    </div>
                    <div class="w-1/2 px-2">
                        <div class="h-150 bg-active rounded-lg">
                        </div>
                        <h3 class="mt-4">
                            Ceci est un test
                        </h3>
                        <p>
                            Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...
                            </br>
                            <a>Lire la suite.</a>
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
}
</page-query>
