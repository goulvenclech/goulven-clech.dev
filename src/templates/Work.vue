<template>
    <Layout>
        <main class="max-w-content mx-auto min-h-full">
            <!-- hero -->
            <div class="flex flex-wrap overflow-hidden">
                <h2 class="text-font my-24 sm:my-40 flex-auto">
                    {{ $page.work.title }}
                </h2>
                <g-image :src="$page.work.image"
                         class="flex"
                />
            </div>
            <!-- content -->
            <div class="content max-w-post mx-auto" v-html="$page.work.content"></div>
            <!-- boutons -->
            <div class="flex flex-wrap justify-center">
                <div v-if="$page.work.website" class="flex">
                    <a :href="$page.work.website"
                       class="m-2 text-center text-font border-none font-bold hover:text-font"
                    >
                        <div class="bg-area hover:bg-primary rounded-lg w-64 inline-block text-center px-4 py-3 duration-200">
                            Visit the website
                        </div>
                    </a>
                </div>
                <div v-else class="flex ">
                    <div class="m-2 text-center text-font border-none font-bold hover:text-font">
                        <div class="bg-area rounded-lg w-64 inline-block text-center px-4 py-3 duration-200">
                            Work in progress
                        </div>
                    </div>
                </div>
                <div v-if="$page.work.source" class="flex">
                    <a :href="$page.work.source"
                       class="m-2 text-center text-font border-none font-bold hover:text-font"
                    >
                        <div class="bg-body hover:bg-primary rounded-lg w-64 inline-block text-center px-4 py-3 duration-200">
                            View on Github <font-awesome :icon="['fab', 'github']" />
                        </div>
                    </a>
                </div>
                <div>
                </div>
            </div>
        </main>
    </Layout>
</template>

<style lang="postcss">
    img {
        @apply object-top object-cover w-400 h-200 rounded-lg my-4;
    }
</style>

<page-query>
query ($id: ID!) {
    work(id: $id) {
        title
        slug
        image
        content
        website
        source
    }
}
</page-query>
