---
title: "Mon retour sur Arch Linux"
slug: "2020-archlinux"
date: "050820"
description: "Lassé par Ubuntu et ses variantes, j'ai décidé de changer d'environnement de travail pour Arch Linux..."
image: "./20-08-passageaarchlinux.png"
---

Depuis la sortie de Pop!_OS 20.04, je m'étais laissé tenté par cette distribution développée par System76 et la promesse d'une expérience Linux à la fois grand public et complète.

Et effectivement, cette distro est impressionnante à bien des égards : une installation simple et rapide, une expérience Gnome plus clean par défaut que celle d'Ubuntu, avec cependant quelques ajouts bienvenues comme un système de Tiling (qui ne fonctionne pas toujours parfaitement, notamment avec les applications Gnome, mais il s'agit d'une bêta) et un store plus complet. Pop!_OS conviendra sans aucun doute à tout utilisateur débutant sur GNU/Linux, et je la conseille vivement.

Néanmoins, cette distro n'en reste pas moins basée sur Debian/Ubuntu, dont les choix technologiques douteux et les paquets souvent obsolètes (NodeJS n'est pas à jour !) m'imposait beaucoup de friction au quotidien. J'étais également frustré par Gnome qui est très difficile à personnaliser : la majorité des GTK Themes et des extensions n'étant pas à jour, et les faire par soi-même est inutilement complexe et demande beaucoup de maintenance. De plus, malgré des progrès, ce WM continue à avoir beaucoup de problèmes de performances et certains éléments d'UX design sont un peu daté ou clunky.

Bien décidé à me débarrasser de cette friction, j'ai donc décidé de revenir sur Arch Linux, mais cette fois sans utiliser Manjaro, qui m'avait vraiment déplu. Grâce à l'aide d'une amie, j'ai réussi à installer et configurer assez rapidement Arch, même si le processus est bien entendu plus complexe et chronophage que sur PopOS.

J'ai notamment eu beaucoup de mal quand, quelques jours plus tard, j'ai tenté (sans mon amie) d'installer Arch sur mon PC portable. En effet, alors que la démarche pour obtenir Internet a consisté à brancher un câble ethernet sur ma tour, j'ai été contraint d'utiliser le wifi pour connecter mon laptop mais impossible de trouver un tutoriel à jour ! Les utilitaires qu'ils recommandaient venaient d'être supprimé de l'ISO d'installation Arch il y a quelques jours, et j'ai pris quelques temps à comprendre que j'étais censé utiliser 'iwctl'. Heureusement, ce dernier est très simple d'utilisation et sa page wiki déjà très complète, je suppose que les tutoriels disponibles sur Internet vont progressivement s'y adapter.

![Screen de mon environnement de travail](./20-08-passageaarchlinux1.png)

Est-ce que toutes ces aventures valaient le coup ? Complètement.

Je suis tombé totalement amoureux de i3gaps, qui est un gestionnaire de fenêtre à la fois minimaliste, performant, qui permet d'avoir un bureau magnifique, facilement personnalisable, ultra minimaliste, tout en boostant votre productivité grâce à des super raccourcis clavier... Je ré-découvre également l'AUR (j'utilise 'yay' comme AUR Helper) qui permet de télécharger n'importe quelle version de tous vos logiciels favoris, à jour, en une seule ligne de commande.

J'ai passé plusieurs heures à personnaliser mon environnement, et je suis très content du résultat. La seule chose que je pense changer dans le futur proche, c'est l'absence de barre. En effet, si actuellement sur mon setup avec un écran, je préfère avoir un bureau le plus clean possible et me forcer à utiliser les raccourcis clavier, je pense installer Polybar dès que j'aurais un second écran à nouveau (et ne l'afficher que sur le premier) pour pouvoir ponctuellement naviguer plus facilement à la souris.

Pour conclure, ce changement d'environnement de travail fut une bouffée d'air frais et m'a permis d'être beaucoup plus à l'aise avec mes ordinateurs ces dernières semaines. Si cela vous intéresse, n'hésitez pas à consulter [mes fichiers de configuration](https://github.com/GoulvenC/dotfiles) (dotfiles) sur Github pour vous en inspirer :)
