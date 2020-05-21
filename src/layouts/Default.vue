<template>
    <div class="p-4">
        <Header />
        <transition name="slide" appear>
            <main>
                <slot></slot>
            </main>
        </transition>
    </div>
</template>

<style lang="postcss" scoped>
    .slide-enter-active {
        transition: all 0.5s cubic-bezier(0.14, 0.74, 0, 0.98);
    }

    .slide-leave-active {
        transition: all 0.8s cubic-bezier(0.14, 0.74, 0, 0.98);
    }

    .slide-enter, .slide-leave {
        transform: translateY(50%);
    }

    html {
        height: 100%;
    }
</style>

<static-query>
query {
  metadata {
    siteName
  }
}
</static-query>

<script>
    import Header from './components/Header.vue';

    export default {
        components: {
            Header,

        },
        metaInfo: {
            title: 'Goulven CLEC\'H, web developer in Toulouse',
        },
    };
</script>
