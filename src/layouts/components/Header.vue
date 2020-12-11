<template>
    <header class="max-w-content mx-auto px-2">
        <h1 class="text-base md:text-lg inline-block l font-body ">
            <a href="/" class="font-extrabold shadow-none text-font hover:text-font hover:shadow-none">
                Goulven CLEC'H
            </a>
        </h1>
        <!-- Menu Desktop -->
        <nav class="float-none md:float-right">
            <ul class="text-base font-body">
                <li><a href="/resume">A propos</a></li>
                <li><a href="/folio">Portfolio</a></li>
                <li><a href="/blog">Blog</a></li>
                <li><a href="https://github.com/GoulvenC" target="_blank">Github</a></li>
            </ul>
        </nav>
        <!-- Menu mobile Switcher WIP
        <button class="lg:hidden" @click.native="toggleMobileMenu()">
            <g-image src="~/assets/menu.svg"
                     immediate="true"
                     quality="100"
            />
        </button> -->
    </header>
</template>

<style lang="postcss">
    header {
        line-height: 40px;

        & li {
            @apply inline-block align-top mr-4 pb-2;

            line-height: 30px;

            & a {
                @apply border-none;
            }
        }
    }

    button {
        touch-action: manipulation;
        float: right;

        & img {
            @apply inline-block;

            height: 30px;
            width: 30px;
            margin: 10px;
        }

        &:hover {
            @apply bg-area cursor-pointer;

            border-radius: 24px;
        }
    }

    @screen md {
        header, header li {
            line-height: 50px;
            padding-bottom: 0;
        }
    }
</style>
