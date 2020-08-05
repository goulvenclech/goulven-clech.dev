<template>
    <Layout>
        <article class="">
            <!-- hero -->
            <div class="bg-area-2 w-full">
                <div class="max-w-content mx-auto p-2">
                    <h2>{{ $page.article.title }}</h2>
                </div>
            </div>
            <!-- content -->
            <div class="content max-w-post mx-auto" v-html="$page.article.content"></div>
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
            content
        }
    }
</page-query>
