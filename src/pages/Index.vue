<template>
    <Layout>
        <main class="max-w-content mx-auto">
            <h2 class="text-font my-40">
                I'm making magic with <Skills />
            </h2>
            <g-link v-for="work in $page.works.edges"
                    :key="work.weight"
                    :to="work.node.path"
            >
                <div
                    :class="['bg-' + work.node.color, 'w-full', 'h-featuredClass', 'my-4', 'rounded-lg', 'test']"
                >
                    <g-image :src="work.node.image" class="object-top object-cover w-700 mx-auto illu relative rounded-lg" />
                </div>
            </g-link>
        </main>
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

    .test:hover .illu {
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
                color
                image
                path
                weight
            }
        }
    }
}
</page-query>
