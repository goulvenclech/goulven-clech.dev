<template>
    <Layout>
        <article class="">
            <!-- hero -->
            <div class="bg-area-2 w-full">
                <div class="max-w-content mx-auto p-2">
                    <h2>{{ $page.work.title }}</h2>
                </div>
            </div>
            <g-image :src="$page.work.image"
                     alt="Image de la page d'accueil du site"
            />
            <!-- content -->
            <div class="content max-w-post mx-auto" v-html="$page.work.content"></div>
            <!-- boutons -->
            <div class="flex flex-wrap justify-center">
                <div v-if="$page.work.website" class="flex">
                    <a :href="$page.work.website"
                       class="m-2 text-center text-font border-none font-bold hover:text-font"
                    >
                        <div class="bg-area hover:bg-primary rounded-lg w-64 inline-block text-center px-4 py-3 duration-200">
                            Visiter le site
                        </div>
                    </a>
                </div>
                <div v-else class="flex ">
                    <div class="m-2 text-center text-font border-none font-bold hover:text-font">
                        <div class="bg-area rounded-lg w-64 inline-block text-center px-4 py-3 duration-200">
                            En développement
                        </div>
                    </div>
                </div>
                <div v-if="$page.work.source" class="flex">
                    <a :href="$page.work.source"
                       class="m-2 text-center text-font border-none font-bold hover:text-font"
                    >
                        <div class="bg-body hover:bg-primary rounded-lg w-64 inline-block text-center px-4 py-3 duration-200">
                            Voir le code source <font-awesome :icon="['fab', 'github']" />
                        </div>
                    </a>
                </div>
                <div>
                </div>
            </div>
        </article>
    </Layout>
</template>

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
