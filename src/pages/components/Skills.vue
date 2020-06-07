<template>
    <transition-group name="rotate" class="intro__keywords inline-block relative">
        <div v-show="currentText == 0" key="0" class="text-green-600">
            VueJS
        </div>
        <div v-show="currentText == 1" key="1" class="text-red-600">
            HTML5
        </div>
        <div v-show="currentText == 2" key="2" class="text-yellow-500">
            Javascript
        </div>
        <div v-show="currentText == 3" key="3" class="text-purple-600">
            SASS
        </div>
        <div v-show="currentText == 4" key="4" class="text-teal-500">
            Tailwind
        </div>
        <div v-show="currentText == 5" key="5" class="text-gray-600">
            Git
        </div>
        <div v-show="currentText == 6" key="6" class="text-pink-600">
            GraphQL
        </div>
        <div v-show="currentText == 7" key="7" class="text-orange-700">
            coffee
        </div>
    </transition-group>
</template>

<style Lang="scss" scoped>
    .rotate-enter-active {
        transition: color 1s, opacity 1s, transform 1s ease-in-out;
        transform: translateY(10px);
        opacity: 0;
    }

    .rotate-leave-active {
        transition: opacity 0.6s, transform 1s ease-in-out;
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        width: 100%;
    }

    .rotate-enter-to {
        transform: translateY(0);
        opacity: 1;
    }

    .rotate-leave-to {
        transform: translateY(-10px);
        opacity: 0;
    }
</style>

<script>
    export default {
        data() {
            return {
                currentText: 0,
            };
        },
        mounted() {
            (($vm) => {
                (function animate() {
                    $vm.counter = setTimeout(() => {
                        $vm.currentText = ($vm.currentText + 1) % 8;
                        requestAnimationFrame(animate);
                    }, 1500);
                }());
            })(this);
        },
        destroyed() {
            clearTimeout(this.counter);
        },
    };
</script>
