# TheCode Python

This is the repo of TheCode project!

It's a Python project the build an application for the project TheCode.

TheCode, it's a personal project to generate passwords with a secret key & the website name.

In short, you need to remember a simple key and by using the same simple key in addition to the website name you have a very secured password.

You have secured & different passwords for all your accounts by remembering only one key.

> A website is available at address: [thecode.julsql.fr](http://thecode.julsql.fr)
> 
> A mobile app is at: [play.google.com/store/apps/details?id=fr.juliette.thecode](https://play.google.com/store/apps/details?id=fr.juliette.thecode)

## Table of Contents

- [Information](#information)
- [App Structure](#app-structure)
- [Installation](#installation)
- [Authors](#authors)

## Information

TheCode uses the secret key + the website name and hash it with sha256.\
With the hex data generate by the hash, it converts it in a new base with the characters selected (lower alphabet, UPPER alphabet, numbers…)

## App Structure

- [main.py](main.py): The files to launch
- [thecode.py](thecode.py): The functions
- [app.py](app.py): The app

## Installation

> You need to have python3 and pip installed on your machine

1. Clone git repository

    ```bash
    git clone git@github.com:TheCodeDevLab/TheCode_Python.git
    ```

2. Configure the python virtual environment

    ```bash
    pip install virtualenv
    cd TheCode_Python
    python3 -m venv env
    source env/bin/activate
    ```
   
3. Install the libraries

    ```bash
    pip install -r requirements.txt
   ```

4. Launch the app

    ```bash
    ./main.py
    ```
   
5. To leave the virtual environment
    ```bash
    deactivate
    ```

## Authors

- Jul SQL
