<template>
    <Layout>
        <article>
            <!-- hero -->
            <div class="bg-area-2 w-full">
                <div class="max-w-content mx-auto p-2">
                    <h2>{{ $page.article.title }}</h2>
                    <p>{{ $page.article.description }}</p>
                </div>
            </div>
            <div class="content max-w-post mx-auto px-2">
                <g-image :src="$page.article.image"
                         class="max-w-full mb-0"
                         alt="Image de couverture"
                />
            </div>
            <!-- content -->
            <div class="content max-w-post mx-auto p-2" v-html="$page.article.content"></div>
        </article>
    </Layout>
</template>

<page-query>
    query ($id: ID!) {
        article(id: $id) {
            title
            slug
            date
            description
            image
            content
        }
    }
</page-query>
