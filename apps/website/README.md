# TheCode

This is the repo of TheCode project!

It's a Vue website for the TheCode project.

TheCode, it's a personal project to generate passwords with a secret key & the website name.

In short, you need to remember a simple key and by using the same simple key in addition to the website name you have a very secured password.

You have secured & different passwords for all your accounts by remembering only one key.

> Website available at address: [thecode.julsql.fr](http://thecode.julsql.fr)
> 
## Information

TheCode uses the secret key + the website name and hash it with sha256.\
With the hex data generate by the hash, it converts it in a new base with the characters selected (lower alphabet, UPPER alphabet, numbers…)

## Installation

```shell
npm install
npm run dev
```

## Test

```shell
npm test
```