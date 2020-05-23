<template>
    <Layout>
        <div class="max-w-content mx-auto">
            <h2 class="text-font my-24 sm:my-32">
                I'm making magic with <Skills />
            </h2>
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
                     class="bg-area w-full h-featuredClass my-4 rounded-lg hotspot"
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

<script>
    import Skills from './components/Skills.vue';

    export default {
        components: {
            Skills,
        },
    };
</script>

<style lang="postcss">
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
        width: 735px;
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
