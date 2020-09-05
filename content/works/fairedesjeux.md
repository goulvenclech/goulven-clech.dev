---
title: "FaireDesJeux.fr"
slug: "fairedesjeux"
website: "https://fairedesjeux.fr"
source: "https://github.com/gamedevalliance/fairedesjeux.fr"
color: "primary"
image: "./fairedesjeux.png"
weight: 1
---

Après plusieurs années à développer [le wiki Game Dev Alliance](https://wiki.gamedevalliance.fr), nous avons décidé de créer un véritable site collaboratif de tutoriels. J'ai réalisé le design avec Figma et Krita, avant de produire le site avec Gridsome, un framework VueJS. Nous avons également utilisé Tailwind, PostCSS, Font Awesome, Remark et PrismJS.

![Image d'une page de cours](./fairedesjeux-2.png)

Les points forts du design est son thème sombre par défaut et la mise en avant de la dimension collaborative du site (lien pour modifier une page, médaille pour indiquer la qualité d'un cours, etc).

Du point de vue technique, Gridsome nous permet de facilement créer des pages web à partir de fichiers markdowns, ces derniers étant plus simples à comprendre pour d'éventuels contributeurs non initiés aux technologies web. Il s'agit également d'une application web progressive, qui peut être consultée hors ligne et répond aux standards modernes fixés par Google. Enfin, en limitant le javascript exécuté coté client et en utilisant du lazi-load, nous assurons une navigation rapide et fluide pour nos utilisateurs.
