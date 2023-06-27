
# Prueba técnica backend node challenge
## Author: Hernán Borré - Kairós 

El webhook de copiado desde la nube (S3 bucket) hacia el local server API desarrollada , fue realizado desde el mismo endpoint principal de upload task ya que no se posee DNS / public IP para poder llamaron desde la misma Lambda function o bien desde otra lambda que se ejecute cuando la lambda de resizing termina de hacer su tarea. 

Se implementó en algunos endpoints la separación en capas de Clean Code Architecure.

No se utilizaron frameworks que facilitan el armado de capas / scaffolding / etc pero sería lo mejor utilizar alguna herramienta que propicie las buenas prácticas de separación en capas y buenas prácticas de desarrollo de backends.

Se utilizó un id numérico autoincremental empezando desde 1 para los ids de las entidades en la base de datos para simplicidad y practicidad de testing y desarrollo de este ejercicio técnico. Sin embargo, sería ideal poder implentar un uuid o similar. 

Se utilizó un token simulado fijo que quien llame al webhook debe conocer, lo correcto hubiera tener que estar autenticado o enviar algún otro id en los parámetros del post del webhook para poder descartar rápidamente cualquier intruso no deseado en el llamado de nuestro enpoint de guardado de las imágenes resizeadas en nuestro servidor backend.  

La cloud function desplegada en aws lambda functions, utiliza la librería Sharp https://github.com/lovell/sharp para convertir el tamaño de las imágenes

Pendientes: 

- Implementar un sistema de logging
- Implementar documentación de la api con swagger
- Manejo exhaustivo de errores y excepciones

Puede encontrar la colección de POSTMAN exportada preconfigurada con los endpoints disponibles para este challenge en el raíz del proyecto con el nombre: <em>'HB-BACKEND-CHALLENGE.postman_collection.json'</em>

Unit Tests
```sh
npm install 
npm test
```

Instalación
```sh
npm install 
npx prisma generate
npx tsc
node dist/index.js
```

NOTA1: Tenga a bien hacer un uso responsable de la cantidad de veces en que correrá este programa y con quien compartirá la información del mismo ya que la cuenta de AWS en la que se llama y ejecuta la Lambda es una cuenta personal del autor de este challenge. 
NOTA2: El sistema de archivos de escritura de las imágenes y los path de los directorios fueron echos para sistemas operativos con file systems unix like. Al dockerizar este proyecto, esto no sería un problema. 

Troubleshooting: 
* Si el sistema es inciado en modo desarrollo `npm run dev` es posible que tenga problemas para iniciar el servidor si no cierra correctamente el proceso iniciado debido al intento de uso de un puerto ocupado, para eso ejecute en una terminal: 
```sh 
pkill -f nodemon
```

* Si visualiza algún error relacionado con Prisma o la Base de datos, asegurese de tener bien configurado el cliente de Prisma y de haber ejecutado el comando: 
```sh 
npx prisma generate
```

