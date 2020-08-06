<template>
    <Layout>
        <div class="bg-area-2 w-full">
            <div class="max-w-content mx-auto p-2">
                <h2>Mes derniers articles</h2>
                <p>
                    Régulièrement, je publie des articles sur mon travail, mon environnement de travail et
                    mes différentes passions.
                </p>
            </div>
        </div>
        <div class="max-w-content mx-auto p-2">
            <div class="flex flex-wrap -mx-2">
                <div v-for="article in $page.articles.edges"
                     :key="article.date"
                     class="w-full sm:w-1/2 px-2"
                >
                    <g-image
                        :src="article.node.image"
                        class="h-150 object-cover"
                        alt="Image de couverture"
                    />
                    <h3 class="mt-4">
                        {{ article.node.title }}
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
    </Layout>
</template>

<page-query>
query {
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
