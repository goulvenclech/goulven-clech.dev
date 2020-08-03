<template>
    <Layout>
        <!-- Présentation -->
        <div class="bg-area-2 w-full">
            <div class="max-w-content mx-auto p-2">
                <h2>Mon portfolio</h2>
                <p>
                    Une sélection de mes réalisations favorites et de mes projets en cours !
                </p>
            </div>
        </div>
        <!-- Dernier travaux -->
        <div class="max-w-content mx-auto p-2">
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
    </Layout>
</template>

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
