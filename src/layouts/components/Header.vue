<template>
    <header class="max-w-content mx-auto px-2">
        <h1 class="text-lg inline-block l font-body font-extrabold">
            <a href="/" class="border-0 text-font hover:text-font">
                Goulven CLEC'H
            </a>
        </h1>
        <ul class="text-base inline-block float-right font-body">
            <li><a href="/resume">A propos</a></li>
            <li><a href="/">Travaux</a></li>
            <li><a href="/">Blog</a></li>
            <li><a href="https://github.com/GoulvenC" target="_blank">Github</a></li>
        </ul>
    </header>
</template>

<style lang="postcss">
    header {
        line-height: 50px;

        & li {
            @apply inline-block ml-4;
            line-height: 50px;

            & a {
                @apply border-none;
            }
        }
    }
</style>
