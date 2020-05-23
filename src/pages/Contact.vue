<template>
    <layout>
        <div class="max-w-content mx-auto">
            <h2 class="my-24 sm:my-32">
                Contact me
            </h2>
            <form method="post"
                  name="contact"
                  data-netify="true"
                  class="content max-w-form mx-auto text-font leading-normal"
            >
                <div class="my-4">
                    <label for="name">Name</label>
                    <input id="name" type="text" name="user_name" />
                </div>
                <div class="my-4">
                    <label for="mail">Mail</label>
                    <input id="mail" type="email" name="user_mail" />
                </div>
                <div class="my-4">
                    <label for="msg">Your message</label>
                    <textarea id="msg" name="user_message"></textarea>
                </div>
                <a
                    class="flex justify-center m-4 text-center text-font border-none font-bold hover:text-font"
                    type="submit"
                >
                    <div class="bg-area hover:bg-primary rounded-lg w-40 inline-block text-center px-4 py-3 duration-200">
                        Send <font-awesome :icon="['fas', 'paper-plane']" />
                    </div>
                </a>
            </form>
        </div>
    </layout>
</template>

<style lang="postcss" scoped>
    input, textarea {
        @apply w-full my-2 p-2 rounded-lg bg-area leading-relaxed outline-none border-2 border-solid border-transparent;

        &:focus {
            @apply border-primary;
        }
    }

    label {
        @apply text-xl font-semibold;
    }
</style>
