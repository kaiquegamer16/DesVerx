(function() {

    class Engine {
        /**
         * @param {HTMLElement} container
         */
        constructor(container) {
            this.container = container;
            this.sceneManager = new SceneManager();
            this.renderer = new Renderer(container);
            this.cameraManager = new CameraManager();
            this.controls = new THREE.OrbitControls(this.cameraManager.camera, this.renderer.renderer.domElement);

            this.animationLoop = this.animationLoop.bind(this);
            this.start();

            /**
             * @type {Object<string, any>}
             */
            this.world = {
                objects: {} // Armazena os objetos antes de renderizar
            };

            // Garante que 'this' esteja correto ao chamar addLighting
            this.addLighting = this.addLighting.bind(this);
            this.addLighting(); // Adiciona luz na cena

            this.selectedObject = null; // Inicializa o objeto selecionado
            this.raycaster = new THREE.Raycaster(); // Para seleção de objetos
            this.mouse = new THREE.Vector2(); // Posição do mouse

            // Adiciona um listener para o evento de clique
            this.renderer.renderer.domElement.addEventListener('click', this.onSceneClick.bind(this), false);

            // Salva a instância na variável global
            window.myEngineInstance = this;
        }

        start() {
            this.renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
            this.animationLoop();
            window.addEventListener('resize', () => this.onWindowResize(), false);
        }

        /**
         * @param {THREE.Scene} scene
         */
        setScene(scene) {
            this.sceneManager.setScene(scene);
        }

        /**
         * @param {THREE.Camera} camera
         */
        setCamera(camera) {
            this.cameraManager.setCamera(camera);
        }

        onWindowResize = () => {
            const { offsetWidth: width, offsetHeight: height } = this.container;
            this.cameraManager.camera.aspect = width / height;
            this.cameraManager.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }

        animationLoop() {
            requestAnimationFrame(this.animationLoop);
            this.controls.update(); // Atualiza os controles da câmera
            this.renderer.render(this.sceneManager.scene, this.cameraManager.camera);
        }

        dispose() {
            window.removeEventListener('resize', this.onWindowResize);
            this.renderer.dispose();
            this.sceneManager.dispose();
        }

        /**
         * @param {string} name
         * @param {any} data
         */
        addObject(name, data) {
            this.world.objects[name] = data;
        }

        loadSceneFromData() {
            for (const name in this.world.objects) {
                if (this.world.objects.hasOwnProperty(name)) {
                    const objectData = this.world.objects[name];
                    try {
                        const object = this.createObjectFromData(objectData);
                        if (object) this.sceneManager.add(object);
                    } catch (error) {
                        console.error(`Erro ao carregar objeto ${name}:`, error);
                    }
                }
            }
        }

        /**
         * @param {any} data
         * @returns {THREE.Mesh | null}
         */
        createObjectFromData(data) {
            switch (data.type) {
                case 'box':
                    const boxGeometry = new THREE.BoxGeometry(data.width, data.height, data.depth);
                    const boxMaterial = new THREE.MeshStandardMaterial({ color: data.color });
                    const box = new THREE.Mesh(boxGeometry, boxMaterial);
                    box.castShadow = true;
                    box.receiveShadow = true;
                    this.applyCommonProperties(box, data); // Aplica posição, escala, etc.
                    return box;

                case 'sphere':
                    const sphereGeometry = new THREE.SphereGeometry(data.radius, 32, 32);
                    const sphereMaterial = new THREE.MeshStandardMaterial({ color: data.color });
                    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                    sphere.castShadow = true;
                    sphere.receiveShadow = true;
                    this.applyCommonProperties(sphere, data); // Aplica posição, escala, etc.
                    return sphere;

                case 'ambientLight':
                    const ambientLight = new THREE.AmbientLight(data.color, data.intensity);
                    this.applyCommonProperties(ambientLight, data);
                    return ambientLight;

                case 'directionalLight':
                    const directionalLight = new THREE.DirectionalLight(data.color, data.intensity);
                    this.applyCommonProperties(directionalLight, data);
                    directionalLight.position.set(data.position.x, data.position.y, data.position.z);
                    directionalLight.castShadow = true;
                    return directionalLight;

                default:
                    console.warn(`Tipo de objeto desconhecido: ${data.type}`);
                    return null;
            }
        }

        applyCommonProperties(object, data) {
            if (data.name) object.name = data.name;
            if (data.position) object.position.set(data.position.x, data.position.y, data.position.z);
            if (data.rotation) object.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
            if (data.scale) object.scale.set(data.scale.x, data.scale.y, data.scale.z);
        }

        onSceneClick(event) {
            // Calcula a posição normalizada do mouse
            this.mouse.x = (event.clientX / this.renderer.renderer.domElement.clientWidth) * 2 - 1;
            this.mouse.y = - (event.clientY / this.renderer.renderer.domElement.clientHeight) * 2 + 1;

            // Atualiza o raycaster com a posição do mouse
            this.raycaster.setFromCamera(this.mouse, this.cameraManager.camera);

            // Calcula os objetos que o raio intersecta
            const intersects = this.raycaster.intersectObjects(this.sceneManager.scene.children, true);

            if (intersects.length > 0) {
                this.selectedObject = intersects[0].object;
                console.log("Objeto selecionado:", this.selectedObject.name);
                // Aqui você pode adicionar uma forma de exibir o nome do objeto selecionado
                // em um campo de input para permitir que o usuário o renomeie.
            } else {
                this.selectedObject = null;
                console.log("Nenhum objeto selecionado.");
            }
        }

        loadSceneFromJson(json) {
            const sceneData = JSON.parse(json);

            // Limpa a cena existente
            this.sceneManager.dispose();
            this.sceneManager.scene = new THREE.Scene(); // Cria uma nova cena
            this.sceneManager.scene.background = new THREE.Color(sceneData.background);

            // Adiciona as luzes padrões
            this.addLighting();

            // Recria os objetos
            sceneData.objects.forEach(objectData => {
                let object;
                if (objectData.type === 'box' || objectData.type === 'sphere') {
                    // Adapta os dados para a função createObjectFromData
                    const adaptedData = {
                        name: objectData.name, // Adiciona o nome aqui
                        type: objectData.type,
                        width: objectData.width,
                        height: objectData.height,
                        depth: objectData.depth,
                        radius: objectData.radius,
                        color: objectData.color,
                        position: objectData.position,
                        scale: objectData.scale,
                        rotation: objectData.rotation
                    };
                    object = this.createObjectFromData(adaptedData);
                }
                else if (objectData.type === 'ambientLight') {
                    const adaptedData = {
                        name: objectData.name,
                        type: objectData.type,
                        color: objectData.color,
                        intensity: objectData.intensity,
                    };
                    object = this.createObjectFromData(adaptedData);
                }
                else if (objectData.type === 'directionalLight') {
                    const adaptedData = {
                        name: objectData.name,
                        type: objectData.type,
                        color: objectData.color,
                        intensity: objectData.intensity,
                        position: objectData.position,
                    };
                    object = this.createObjectFromData(adaptedData);
                    if (objectData.position) {
                        object.position.set(objectData.position.x, objectData.position.y, objectData.position.z);
                    }
                }

                if (object) {
                    this.sceneManager.add(object);
                }
            });
        }
        clearScene() {
          // Remove todos os objetos da cena, exceto as luzes padrão
          this.sceneManager.scene.children.forEach(child => {
              if (child.type !== 'AmbientLight' && child.type !== 'DirectionalLight') {
                  this.sceneManager.scene.remove(child);

                  // Garante que os recursos sejam liberados
                  if (child.geometry) child.geometry.dispose();
                  if (child.material) {
                      if (child.material.map) child.material.map.dispose();
                      child.material.dispose();
                  }
              }
          });

          // Limpa o objeto selecionado
          this.selectedObject = null;

          // Limpa o world
          this.world.objects = {};
      }

        saveSceneToJson() {
            const sceneData = {
                background: this.sceneManager.scene.background.getHex(), // Salva a cor de fundo em hexadecimal
                objects: this.sceneManager.scene.children.map(obj => {
                    if (obj.type === 'Mesh') {
                        let geometryType = 'unknown';
                        if (obj.geometry instanceof THREE.BoxGeometry) {
                            geometryType = 'box';
                        } else if (obj.geometry instanceof THREE.SphereGeometry) {
                            geometryType = 'sphere';
                        } else {
                            console.warn('Geometria não suportada para salvamento:', obj.geometry);
                            return null; // Ignora geometrias não suportadas
                        }

                        return {
                            name: obj.name || 'unnamed',
                            type: geometryType,
                            position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                            rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                            scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
                            color: obj.material.color.getHex() // Salva a cor em hexadecimal
                        };
                    } else if (obj.type === 'AmbientLight') {
                        return {
                            name: obj.name || 'unnamed',
                            type: 'ambientLight',
                            color: obj.color.getHex(),
                            intensity: obj.intensity
                        };
                    }
                    else if (obj.type === 'DirectionalLight') {
                        return {
                            name: obj.name || 'unnamed',
                            type: 'directionalLight',
                            color: obj.color.getHex(),
                            intensity: obj.intensity,
                            position: { x: obj.position.x, y: obj.position.y, z: obj.position.z }
                        };
                    }
                    else {
                        console.warn('Tipo de objeto não suportado para salvamento:', obj);
                        return null; // Ignora tipos não suportados (câmeras, etc.)
                    }
                }).filter(obj => obj !== null) // Remove objetos nulos (não suportados)
            };

            const json = JSON.stringify(sceneData, null, 2); // Converte para JSON formatado

            this.downloadJson(json, 'scene.json'); // Inicia o download
        }

        downloadJson(json, filename) {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); // Limpa a URL
        }

        addLighting() {
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Luz ambiente fraca
            this.sceneManager.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 5, 5);
            directionalLight.castShadow = true;
            this.sceneManager.add(directionalLight);
        }
    }

    class SceneManager {
        constructor() {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87CEEB); // Cor do céu
        }

        /**
         * @param {THREE.Scene} scene
         */
        setScene(scene) {
            this.scene = scene;
        }

        /**
         * @param {...THREE.Object3D} objects
         */
        add(...objects) {
            objects.forEach(obj => this.scene.add(obj));
        }

        /**
         * @param {...THREE.Object3D} objects
         */
        remove(...objects) {
            objects.forEach(obj => this.scene.remove(obj));
        }

        dispose() {
            this.scene.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
        }
    }

    class Renderer {
        /**
         * @param {HTMLElement} container
         */
        constructor(container) {
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            this.container = container;
            container.appendChild(this.renderer.domElement);
        }

        /**
         * @param {number} width
         * @param {number} height
         */
        setSize(width, height) {
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }

        /**
         * @param {THREE.Scene} scene
         * @param {THREE.Camera} camera
         */
        render(scene, camera) {
            this.renderer.render(scene, camera);
        }

        dispose() {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
        }
    }

    class CameraManager {
        /**
         * @param {number} [fov=75]
         * @param {number} [near=0.1]
         * @param {{x: number, y: number, z: number}} [position={ x: 3, y: 3, z: 5 }]
         */
        constructor(fov = 75, near = 0.1, far = 1000, position = { x: 3, y: 3, z: 5 }) {
            this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
            this.camera.position.set(position.x, position.y, position.z);
        }

        /**
         * @param {THREE.Camera} camera
         */
        setCamera(camera) {
            this.camera = camera;
        }
    }

    window.Engine = Engine;
    window.SceneManager = SceneManager;
    window.Renderer = Renderer;
    window.CameraManager = CameraManager;
    window.myEngineInstance = null; // Inicializa a variável global

})();
