# Estilo de los write-ups

Notas para redactar los write-ups del blog. No es un post, es una guía interna.

## Voz y tono

- **Siempre en primera persona.** "Lanzo nmap", "me llevo tres cosas", "entro como SYSTEM".
  Nada de "se lanza" ni "el atacante".
- Tono cercano y directo, como explicándoselo a un colega. Vale alguna coña suelta
  en el resumen ("de esas que te suben la moral"), pero sin pasarse en las partes técnicas.
- Español de España. Tildes correctas, incluso en mayúsculas.

## Front matter

```yaml
title: "NombreMáquina"        # solo el nombre, la plataforma va en su campo
date: AAAA-MM-DD HH:MM:SS +0200
categories: [Writeups, HackTheBox]   # la 1ª DEBE ser Writeups
tags: [windows, smb, ...]     # en minúsculas
machine: NombreMáquina        # igual que en _data/oscp.yml -> enlaza el Roadmap
platform: HackTheBox
os: Windows                   # Windows | Linux | ...
difficulty: Easy              # Easy | Medium | Hard | Insane
description: "Una línea: vector de entrada y escalada."
# status: En curso            # quítalo al terminar -> pasa a Resuelta
```

## Estructura (cada ## se convierte en una sección plegable)

1. **Tabla de ficha** (Máquina · SO · Dificultad · IP), sin encabezado `##`, va arriba del todo.
2. `## Resumen` — 3-4 líneas humanas contando de qué va la máquina. Nada de "Camino:".
3. `## Reconocimiento` — mis comandos reales de nmap, con tabla explicando los flags.
4. `## Enumeración` — qué encuentro y qué significa, no solo el volcado.
5. `## La vulnerabilidad` — tablilla con CVE, boletín/MS, de quién es, SO y servicio
   afectados y CVSS; debajo 1-2 párrafos técnicos y humanos (máx ~4 líneas cada uno).
6. `## Explotación` — los pasos tal y como los hice yo (la herramienta que usé de verdad).
7. `## Flags` — user y root.
8. `## Cómo se arregla` — mitigaciones, en lista.
9. `## Conclusiones` — qué me llevo, redactado por mí.

## Comandos que uso de verdad

- Escaneo inicial: `nmap -p- -n -Pn -sS --max-retries 1 IP`
  (si va lento, `--min-rate 5000` o `-T4`).
- Versiones: `nmap -p PUERTOS -n -sCV --version-intensity 9 IP`.

## Formato

- Bloques de consola con la etiqueta de lenguaje (```` ```console ````, ```` ```bash ````).
- Los avisos (`.prompt-tip`, `.prompt-info`, `.prompt-warning`) para apuntes al margen.
- Tablas para flags, puertos, recursos y la ficha de la vulnerabilidad.
- IP y datos sensibles: los reales de la máquina (está retirada), nada inventado
  que contradiga mis capturas.
