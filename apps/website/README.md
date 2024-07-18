# TheCode

This is the repo of TheCode project!

It's a Django project the build a website for the project TheCode.

TheCode, it's a personal project to generate passwords with a secret key & the website name.

In short, you need to remember a simple key and by using the same simple key in addition to the website name you have a very secured password.

You have secured & different passwords for all your accounts by remembering only one key.

> Website available at address: [thecode.h.minet.net](http://thecode.h.minet.net)

## Table of Contents

- [Information](#information)
- [App Structure](#app-structure)
- [Installation](#installation)
- [Deploy](#deploy)
- [Tests](#tests)
- [Authors](#authors)

## Information

TheCode uses the secret key + the website name and hash it with sha256.\
With the hex data generate by the hash, it converts it in a new base with the characters selected (lower alphabet, UPPER alphabet, numbers…)

## App Structure

- [static/](thecode/main/static): The files used by the website (images, documents, css & javascript…)
- [templates/](thecode/main/templates): The html templates of the pages
- [views.py](thecode/main/views.py): the code launch when loading a page
- [thecode/](thecode/thecode): the settings files (urls, wsgi, settings) used by Django
- [manage.py](thecode/manage.py): the main file that runs the website

## Installation

> You need to have python3 and pip installed on your machine

1. Clone git repository

    ```bash
    git clone git@github.com:TheCodeDevLab/thecode_website.git
    ```

2. Don't forget to add the settings file in `./thecode/thecode`

3. Configure the python virtual environment

    ```bash
    pip install virtualenv
    cd thecode_website
    python3 -m venv env
    source env/bin/activate
    ```
   
4. Install the libraries

    ```bash
    pip install -r requirements.txt
   ```

5. Launch the website

    ```bash
    cd thecode
    ./manage.py runserver
    ```
6. To leave the virtual environment
    ```bash
    deactivate
    ```

## Deploy

You need to configure your VM.

Don't forget to download git, python, apache2, pip on your VM:
    
```bash
sudo apt-get update
sudo apt-get install apache2
sudo apt-get install postgresql
sudo apt-get install python3
sudo apt-get install python3-pip
sudo apt-get install libapache2-mod-wsgi-py3
sudo apt-get install git
sudo apt-get install python3-venv
```

After installing the project as explained in [Installation](#installation)
you can configure the VM as follows:

```bash
sudo nano /etc/apache2/sites-available/myconfig.conf
```

```
<VirtualHost *:80>
    ServerName thecode.h.minet.net
    ServerAdmin admin@email.fr

    AddDefaultCharset UTF-8

    Alias /static /home/username/thecode_website/thecode/main/static/
    <Directory /home/username/thecode_website/thecode/main/static/>
        Require all granted
    </Directory>

    <Directory /home/username/thecode_website/thecode/thecode/>
        <Files wsgi.py>
            Require all granted
        </Files>
    </Directory>

    WSGIDaemonProcess thecode_process python-home=/home/username/thecode_website/env python-path=/home/username/thecode_website/thecode
    WSGIProcessGroup thecode_process
    WSGIScriptAlias / /home/username/thecode_website/thecode/thecode/wsgi.py process-group=thecode_process

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

You load the configuration and restart the apache server
```bash
sudo a2ensite myconfig.conf
sudo service apache2 restart
```

> To unload a configuration: `sudo a2dissite myconfig.conf`

## Tests

To run the tests, you need to [install Node](https://nodejs.org/fr). Then:

```bash
cd thecode/main/static/main/assets/js 
npm init -y
npm install --save-dev jest
npm install sjcl
npx jest
```

The file [test.js](thecode/main/static/main/assets/js/test.js) just test the function coder for 2 different site and key.

## Authors

- Jul SQL