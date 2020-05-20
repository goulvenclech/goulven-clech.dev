<template>
    <header class="max-w-content mx-auto">
        <h1 class="text-xl sm:text-2xl inline-block l font-body font-extrabold">
            <a href="/" class="border-0 text-font hover:text-font">
                Goulven CLEC'H
            </a>
        </h1>
        <ul class="text-xs sm:text-base inline-block float-right font-body">
            <li><a href="/resume">Resume</a></li>
            <li><a href="/">Works</a></li>
            <li><a href="https://github.com/GoulvenC" target="_blank">Github</a></li>
            <li><a href="/contact">Contact</a></li>
        </ul>
    </header>
</template>

<style lang="postcss" scoped>
    header {
        line-height: 55px;

        & li {
            @apply inline-block ml-2;
        }

        @screen sm {
            & li {
                @apply ml-3;
            }
        }
    }
</style>
