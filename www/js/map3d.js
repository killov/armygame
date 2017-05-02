function Mapa(map){
    var p = Mapa.prototype;

    p.settings = {
        parentElement: $("#back")
    };

    p.loadedBlocks = [];


    this.map = map;
    
    //Startování mapy, [x,y] výchozí pozice
    this.init = function(x,y){
        init2();
        clicking();
        animate();
        cameraCron();
    };
    
    //Mapa se vycentruje na pole [x,y]
    this.map.pozice = function(x,y){
        
    };
    
    //Bloky která se mají překreslit
    //bloky - seznam bloků [[x1,y1],[x2,y2],...,[xn,yn]]
    this.map.obnovit = function(bloky){
        
    };
    
    //Vykreslení cesty
    //počátek - pole [x,y]
    //cesta - seznam polí [[x1,y1],[x2,y2],...,[xn,yn]]
    this.map.renderCesta = function(pocatek,cesta){
        
    };
    
    //funkce
    //arg1 - seznam bloků, které chci načíst
    //arg2 - callback, provede se na každém bloku

    this.map.load([[0,0],[1,1]],function(json,x,y){
        //json - seznam políček v bloku, seřazené zleva od vrchu,
        //       každé políčko je seznam a obsahuje:    0 - souřadnice x
        //                                              1 - souřadnice y
        //                                              2 - typ: 0 - volné pole
        //                                                       1 - město
        //                                                       2 - les
        //                                                       3 - kopec
        //                                                       4 - voda
        //                                              
        //                                              3 - id
        //                                              4 - orientace políčka
        //                                              5 - id státu
        //                                              6 - hranice
        //                                              pokud je typ město, pak obsahuje navíc:
        //                                              7 - populace
        //                                              8 - jméno města
        //                                              9 - jméno hráče
        //[x,y] - souřadnice bloku                
    });
    
    //získání jednoho pole
    this.map.getPole(5,5);
    
    //získání jména státu
    //arg1 - id státu
    this.map.getStat(5);
    
    //id aktuálního města
    this.map.game.mesto.id;
    
    //id aktuálního státu
    this.map.game.stat;
    
    //zobrazení náhledu aktivního města
    this.map.game.page_go("mesto");
    
    //zobrazení políčka s id 5
    this.map.game.page_go("mestoinfo/5");

    // ALOUSH

    var toLoad = {
        t1 : 'tt1_4',
        t2 : 'tt2_7',
        cxs: 'cities/beta02_01_xs',
        cs: 'cities/beta02_01_s',
        cm: 'cities/beta02_01_m',
        cl: 'cities/beta02_01_l',
        cxl: 'cities/beta02_01_xl'
    };
    var renderer, camera, scene, controls, dirLight, pointLight, h = new Date().getHours(), mapOn, camPosition, animation, animationBack;
    var loader, tt1i = [], tt2i = [], waterMaterial;
    var groundGeo, groundList = [], blokx, bloky, actualRequest, blokHills, treesForInstance = [];
    mapOn = true;
    var mujStat = 23, stateLines, myLines, bigGrid, line, cityLights, cityLightsShown = false;
    var myStateColor, otherStateColor;
    var raycaster, mouse;
    var models = {};
    var stats;
    var screenMultiplier = 100;


    // BASE

    function init2() {
        var ws = p.settings.parentElement.width(),
            hs = p.settings.parentElement.height();

        scene = new THREE.Scene();
        //scene.fog = new THREE.FogExp2(0xCCDAF0, 2.75, 2000);
        h = 9;
        //renderer

        renderer = new THREE.WebGLRenderer({antialias: false});
        renderer.setClearColor(0x72A645);
        //renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(ws, hs);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.cullFace = THREE.CullFaceBack;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        p.settings.parentElement.append(renderer.domElement);

        // stats

        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '50px';
        stats.domElement.style.left = '260px';
        stats.domElement.style.zIndex = 0;
        document.body.appendChild(stats.domElement);

        //camera
        camera = new THREE.OrthographicCamera(
            ws / -screenMultiplier,
            ws / screenMultiplier,
            hs / screenMultiplier,
            hs / -screenMultiplier,
            0.1,
            3000
        );
        camera.position.z = 250;
        camera.position.y = 500;
        camera.rotation.x = -0.6;
        camera.zoom = 1;

        // clicking
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // prepare group for border lines

        stateLines = new THREE.Group();
        stateLines.position.y = -1.5;
        scene.add(stateLines);
        myLines = new THREE.Group();
        myLines.position.y = -1.5;
        scene.add(myLines);

        bigGrid = new THREE.Group();
        bigGrid.position.y = -1.95;
        bigGrid.rotation.set(Math.PI / 2, 0, 0);
        scene.add(bigGrid);
        makeGrid();

        cityLights = new THREE.Group();
        cityLights.position.y = 0;

        myStateColor = new THREE.MeshStandardMaterial({color: 0x5080ff, metalness: 0.02});
        otherStateColor = new THREE.MeshStandardMaterial({color: 0xba6240, metalness: 0.02});

        makeControls();
        makeLights();
        makeWaterMaterial();
        loadModels();

        window.addEventListener('resize', onWindowResize, false);
    }

    function debuggerBar() {

        // own controls
        $('#shadowsOff').click(function () {
            shadowsOff();
        });
        $('#shadowsOn').click(function () {
            shadowsOn();
        });
        $('#makeBlock').click(function () {
            drawBlock(dotaz);
            //drawBlock(dotaz2);
        });
        $('#hideBlock').click(function () {
            hideBlock(0, 0);
        });

        $('#toggleDebugPanel').click(function () {
            var sc = $('.stats-content');
            sc.toggle();
        });

        $('#game-time').val(h);
        $('#load-time').click(function () {
            if (h < 0 || h > 24) {
                return;
            }
            h = parseInt($('#game-time').val());
            scene.remove(dirLight);
            scene.remove(hemiLight);
            makeLights();
            updateLighting();
        });
        var testingAnimateTime = function (x) {
            if (x > 239) {
                return;
            }
            if (h > 23) {
                h = 0;
            }
            h += 0.1;
            $('#game-time').val(h);
            scene.remove(dirLight);
            scene.remove(hemiLight);
            makeLights();
            updateLighting();
            setTimeout(function(){
                testingAnimateTime( x + 1 );
            }, 100);
        };

        $('#animate-time').click(function () {
            testingAnimateTime(0);
        });
    }

    /**
     * Set basic map control
     */
    function makeControls() {
        //controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.minZoom = 0.15;
        controls.maxZoom = 1;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = 1.1;
        controls.minAzimuthAngle = -3.2;
        controls.maxAzimuthAngle = 3.2;
        controls.mouseButtons = {ORBIT: THREE.MOUSE.RIGHT, PAN: THREE.MOUSE.LEFT};
    }

    function animate(time) {
        requestAnimationFrame(animate);

        if(camera.zoom > 0.2){
            forestWind(time);
            animateBorders(time);
            waterAnimation(time);
        }
        if (mapOn) {
            //makeStats();
            //fixLight();
        } else {
            camera.position.x = camPosition.x;
            camera.position.y = camPosition.y;
            camera.position.z = camPosition.z;
            camera.rotation.x = camPosition.rx;
            camera.rotation.y = camPosition.ry;
            camera.rotation.z = camPosition.rz;
            camera.zoom = camPosition.zoom;
        }

        //TWEEN.update(time);

        stats.update();

        controls.update();
        //camera.updateProjectionMatrix();

        render();
    }

    function makeStats() {
        $('#camPosX').html(camera.position.x);
        $('#camPosY').html(camera.position.y);
        $('#camPosZ').html(camera.position.z);
        $('#camRotX').html(camera.rotation.x);
        $('#camRotY').html(camera.rotation.y);
        $('#camRotZ').html(camera.rotation.z);
        $('#camZoom').html(camera.zoom);
    }

    // LOAD

    /**
     * Updating loader for 3d models
     */
    function synchronizeLoader(){
        var percentage = Object.keys(models).length / Object.keys(toLoad).length * 100;
        if(percentage == 100){
            $('.bar .progress').animate({width: percentage+'%'}, 150);
            $('.loader').delay(200).fadeOut();
            //drawBlock(dotaz2);
            console.log("todo - load map");
        } else{
            $('.bar .progress').animate({width: percentage+'%'}, 150);
        }
    }

    function loadModels() {
        for(var model in toLoad){
            if(!toLoad.hasOwnProperty(model)) continue;
            loadModel(model, toLoad[model]);
        }
    }

    function loadModel(key, name){
        loader = new THREE.ColladaLoader();
        loader.options.convertUpAxis = true;
        loader.load(
            // resource URL
            '../models/'+name+'.dae',
            // Function when resource is loaded
            function (collada) {
                models[key] = collada.scene.children[0].children[0];
                synchronizeLoader();
            }
        );
    }

    function drawBlock($a, x, y) {
        actualRequest = $a;
        //var xs = Object.keys($a), xy;
        //for (var i = 0; i < xs.length; i++) {
        //    xy = Object.keys($a[xs[i]]);
        //    for (var j = 0; j < xy.length; j++) {
        //        makeBlock(xs[i], xy[j]);
        //    }
        //}
        makeBlock(x, y);
        makeForest(models.t1, [x, y]);
        makeForest(models.t2, [x, y]);
        treesForInstance = [];
    }

    function render() {
        renderer.render(scene, camera);
    }

    // LIGHTING

    function makeLights() {
        //lights
        // hodiny

        // TODO: vars

        var dirX = -6/15*h + 5.4;
        if(h > 8 && h < 19){
            var hemiColor = new THREE.Color(1, 1, 1);
            var hemiIntensity = 0.5;

            var dirColor = new THREE.Color(1, 0.95, 0.9);
            var dirIntensity = 0.6;
        } else if (h > 5 && h < 9){
            // východ
            var hemiColor = new THREE.Color(1, 1, 0.5);
            var hemiIntensity = (h / 16) - 0.1;

            var dirColor = new THREE.Color(1, 0.95, 0.8);
            var dirIntensity = h / 12 - 0.1;
        } else if(h > 18 && h < 23){
            //západ
            var hemiColor = new THREE.Color(1, 1, 0.6);
            var hemiIntensity = (28 - h) / 16 - 0.05;

            var dirColor = new THREE.Color(1, 0.95, 0.8);
            var dirIntensity = (28 - h)/ 12 - 0.05;
        } else{
            // noc
            var hemiColor = new THREE.Color(1, 1, 1);
            var hemiIntensity = 0.2;

            var dirColor = new THREE.Color(0.9, 0.9, 1);
            var dirIntensity = 0.2;
            //var dirX = -6/30*h + 3.4;
            var dirX = 1.2;
        }

        hemiLight = new THREE.HemisphereLight(hemiColor, hemiColor, hemiIntensity);
        //hemiLight.color.setHSL(1, 1, 1);
        hemiLight.position.set(0, 50, 0);
        scene.add(hemiLight);
        //
        dirLight = new THREE.DirectionalLight(dirColor, dirIntensity + 0.2);
        //dirLight.color.setHSL(0.95, 0.5, 0.95);
        dirLight.position.set(dirX, 1.5, 1.5);
        dirLight.position.multiplyScalar(100);
        scene.add(dirLight);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 512;
        dirLight.shadow.mapSize.height = 512;

        var d = 50;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;

        dirLight.shadow.camera.far = 2500;
        dirLight.shadow.bias = -0.0003;

    }

    function updateLighting(){
        var i;

        if (h > 20 && !cityLightsShown) {
            cityLightsShown = true;
            scene.add(cityLights);
        } else if (h > 6 && h < 20 && cityLightsShown){
            cityLightsShown = false;
            scene.remove(cityLights);
        }

        for(i = 0; i < tt1i.length; i++){
            tt1i[i].material.uniforms.dirIntensity.value = dirLight.intensity;
            tt1i[i].material.uniforms.hemiIntensity.value = hemiLight.intensity;
            tt1i[i].material.uniforms.light.value = dirLight.position;
            tt1i[i].material.uniforms.dirColor.value = dirLight.color;
        }
        for(i = 0; i < tt2i.length; i++){
            tt2i[i].material.uniforms.dirIntensity.value = dirLight.intensity;
            tt2i[i].material.uniforms.hemiIntensity.value = hemiLight.intensity;
            tt2i[i].material.uniforms.light.value = dirLight.position;
            tt2i[i].material.uniforms.dirColor.value = dirLight.color;
        }

        waterMaterial.uniforms.dirIntensity.value = dirLight.intensity;
        waterMaterial.uniforms.hemiIntensity.value = hemiLight.intensity;
        waterMaterial.uniforms.light.value = dirLight.position;
        waterMaterial.uniforms.dirColor.value = dirLight.color;
    }

    function shadowsOff() {
        scene.remove(dirLight);
        dirLight.castShadow = false;
        scene.add(dirLight);
    }

    function shadowsOn() {
        scene.remove(dirLight);
        dirLight.castShadow = true;
        scene.add(dirLight);
    }

    // ANIMATION

    function animateBorders(time){
        myLines.position.y = Math.sin(time*0.002)/8 - 1.5;
    }

    function waterAnimation(t) {
        waterMaterial.uniforms.time.value = t * 0.0030;
        //this.ms_Water.material.uniforms.time.value += 1.0 / 60.0;

    }

    function forestWind(t){
        for(var i = 0; i < tt1i.length; i++){
            tt1i[i].material.uniforms.time.value = t * 0.0033;
        }
        for(var i = 0; i < tt2i.length; i++){
            tt2i[i].material.uniforms.time.value = t * 0.0030;
        }
    }

    // INTERACTION

    function clicking() {
        var dragging = false;
        $("canvas").mousedown(function () {
                dragging = false;
            })
            .mousemove(function () {
                dragging = true;
            })
            .mouseup(function (ev) {
                var notClick = dragging;
                dragging = false;
                if (!notClick) {
                    if (mapOn) {
                        clickOn(ev);
                        //zoomTo();
                    } else {
                        //zoomOut();
                    }
                }
            });
    }

    function clickOn(event) {
        mouse.set(( (event.clientX - p.settings.parentElement.offset().left) / p.settings.parentElement.width() ) * 2 - 1, -( (event.clientY - p.settings.parentElement.offset().top) / p.settings.parentElement.height() ) * 2 + 1);
        raycaster.setFromCamera(mouse, camera);
        var intersects = raycaster.intersectObjects(groundList);
        if (intersects.length > 0) {
            calculateCoords(intersects[0].point);
        }
    }

    function calculateCoords(point) {
        var x, y, pole;
        x = Math.floor((point.x + 2.5) / 5);
        y = Math.floor((-point.z + 1.5) / 5);
        pole = map.getPole(x,y);

        // city
        if (pole[2] == 1) {
            if(map.game.mesto.id == pole[3]){
                map.game.page_go("mesto");
            }else{
                map.game.page_go("mestoinfo/"+pole[3]);
            }
        }
    }

    function zoomTo() {
        mapOn = false;
        controls.minAzimuthAngle = -2;
        controls.maxPolarAngle = 2;
        $('.x-line').hide();
        $('.y-line').hide();
        $('.stats').hide();
        camPosition = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            rx: camera.rotation.x,
            ry: camera.rotation.y,
            rz: camera.rotation.z,
            zoom: camera.zoom
        };
        animation = new TWEEN.Tween(camPosition)
            .to({
                x: -216,
                y: 200,
                z: -40,
                rx: -1.767,
                ry: -0.81,
                rz: 0,
                zoom: 2
            }, 2500)
            .easing(TWEEN.Easing.Sinusoidal.InOut);
        animation.start();
    }

    function zoomOut() {
        animationBack = new TWEEN.Tween(camPosition)
            .to(camPosition, 2500)
            .easing(TWEEN.Easing.Sinusoidal.InOut)
            .onComplete(function () {
                $('.x-line').show();
                $('.y-line').show();
                $('.stats').show();
                controls.minAzimuthAngle = 0;
                controls.maxPolarAngle = 0.7;
                mapOn = true;
            });
        animationBack.start();
    }

    // MAINTENANCE

    function hideBlock(x, y) {
        scene.remove(groundList.x.y);
        scene.update();
    }

    function onWindowResize() {
        var w = p.settings.parentElement.width(),
            h = p.settings.parentElement.height();

        camera.left = -w / screenMultiplier;
        camera.right = w / screenMultiplier;
        camera.top = h / screenMultiplier;
        camera.bottom = h / -screenMultiplier;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    function cameraCron() {
        setInterval(function () {
            var targetPosition = controls.target,
                cameraPosition;

            if (controls.target.y != 0) {
                cameraPosition = camera.position;
                var k = cameraPosition.y / (cameraPosition.y - targetPosition.y);

                controls.target.x = cameraPosition.x - k * (cameraPosition.x - targetPosition.x);
                controls.target.y = 0;
                controls.target.z = cameraPosition.z - k * (cameraPosition.z - targetPosition.z);

                controls.update();
            }

            var actualBlock = {
                x: Math.floor((targetPosition.x + 2.5) / 50),
                z: Math.floor((-targetPosition.z + 1.5) / 50)
            };

            checkVisibleBlocks(actualBlock);
        }, 200);
    }

    /**
     * Check if all wanted blocks are loaded.
     * @param {Object} actualBlock
     */
    function checkVisibleBlocks(actualBlock) {
        if ($.grep(p.loadedBlocks, function(n){return n.x == actualBlock.x && n.z == actualBlock.z}).length == 0) {
            p.loadedBlocks.push(actualBlock);
            map.load([[actualBlock.x, actualBlock.z]], function(json,x,y){
                drawBlock(json, x, y);
            });
        }
    }

    // MAP

    function placeObject(el) {
        var potype = el[2], rx, ry;

        rx = el[0] - (10 * blokx);
        ry = el[1] - (10 * bloky);
        if (rx >= 0 && ry >= 0) {
            if (potype == 1) {
                placeVillage(el)
            } else if (potype == 2) {
                //placeTree(el[0], el[1]);
            } else if (potype == 3) {
                blokHills.push(rx * 1024 + ry);
                buildHill(el, rx, ry);
            } else if (potype == 4) {
                makeWater(el, rx, ry);
            }
            if(el[8]){
                makeLine(el);
            }
        }
    }

    // MODEL - GROUND

    function makeGrid(){
        var mgi, line;
        var myBorderMaterial = new THREE.LineBasicMaterial({color: 0x010101, opacity: 0.15, transparent: true});
        for(mgi = -20; mgi < 20; mgi++){
            line = new THREE.Shape();
            line.moveTo(-1000, mgi * 50 + 2.5);
            line.lineTo(1000, mgi * 50 + 2.5);
            bigGrid.add(new THREE.Line(line.createPointsGeometry(), myBorderMaterial));
        }
        for(mgi = -20; mgi < 20; mgi++){
            line = new THREE.Shape();
            line.moveTo(mgi * 50 - 2.5, -1000);
            line.lineTo(mgi * 50 - 2.5, 1000);
            bigGrid.add(new THREE.Line(line.createPointsGeometry(), myBorderMaterial));
        }
    }

    function makeBlock(x, y) {
        // ground
        groundGeo = new THREE.PlaneGeometry(50, 50, 40, 40);

        // aktuální blok
        blokx = x;
        bloky = y;

        // ukládání souřadnic hor, aby mohl být "fancované" :D
        blokHills = [];

        countTrees();

        // umístit objekty a vytvořit hory
        actualRequest.forEach(placeObject);

        fancyHills();
        colorHills();
        //přepočítat normály kvůli správnému stínování kompců - není nutné?
        //groundGeo.computeFaceNormals();
        //groundGeo.computeVertexNormals();

        // materiál se bere z faces
        var material = new THREE.MeshStandardMaterial(
            {
                vertexColors: THREE.FaceColors,
                roughness: 0.8,
                metalness: 0.1,
                shading: THREE.FlatShading
            });
        var ground = new THREE.Mesh(groundGeo, material);

        // umístění bloku
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.position.x = 22.5 + (x * 50);
        ground.position.z = -22.5 - (y * 50);
        //ground.matrixAutoUpdate = false;
        ground.receiveShadow = true;
        ground.castShadow = true;


        //models.push(ground);
        groundList.push(ground);
        scene.add(ground);
    }

    function colorHills() {
        for (var i = 0; i < groundGeo.faces.length; i++) {
            var face = groundGeo.faces[i], ri = Math.floor(i / 1.9511);
            if (groundGeo.vertices[ri].z < 0.1) {
                face.color.setHex(0x72A645);
            } else if (groundGeo.vertices[ri].z > 2.5) {
                face.color.setHex(0xABABAB);
            } else if (groundGeo.vertices[ri].z > 1.2) {
                face.color.setHex(0x555555);
            } else {
                face.color.setHex(0x518423);
            }
        }
    }

    function buildHill(el, rx, ry) {
        var rp = (ry * 164) - ((rx + 0) * 4) - 1 + 41;
        var z = 1600 - rp, sez = [];
        sez[z] = 1.5;
        sez[z - 1] = 1.1;
        sez[z + 1] = 1.1;
        sez[z + 41] = 1.1;
        sez[z - 41] = 1.1;
        sez[z + 42] = 0.5;
        sez[z - 42] = 0.5;
        sez[z - 40] = 0.2;
        sez[z - 40] = 0.2;
        sez.forEach(editGround);
    }

    function fancyHills() {
        blokHills.forEach(fancyHill);
    }

    function fancyHill(input) {
        var rx, ry, rp, z, sez = [];
        ry = input % 1024;
        rx = (input - ry) / 1024;
        rp = (ry * 164) - ((rx + 0) * 4) - 1 + 41;
        z = 1600 - rp;
        if (haveBL(rx, ry) && haveL(rx, ry) && haveB(rx, ry)) {
            sez[z - 1] = 1.3;
            sez[z - 2] = 1.3;
            sez[z - 3] = 1.3;
            sez[z + 41] = 1.3;
            sez[z + 82] = 1.5;
            sez[z + 123] = 1.3;
            sez[z + 40] = 1.5;
            sez[z + 81] = 2.5;
            sez[z + 122] = 1.5;
            sez[z + 39] = 2.5;
            sez[z + 80] = 2.8;
            sez[z + 121] = 2.5;
            sez[z + 38] = 1.5;
            sez[z + 79] = 2.5;
            sez[z + 120] = 1.5;

            sez[z + 83] = 0.5;
            sez[z + 77] = 0.5;
            sez[z + 203] = 0.5;
            sez[z - 43] = 0.5;

            sez[z + 42] = 0.2;
            sez[z - 42] = 0.2;
            sez[z - 40] = 0.05;
            sez[z - 40] = 0.05;
        } else if (haveL(rx, ry) && haveB(rx, ry)) {
            sez[z - 1] = 1.2;
            sez[z - 2] = 1.4;
            sez[z - 3] = 1.1;
            sez[z - 42] = 1;
            sez[z - 43] = 1.2;
            sez[z - 44] = 1;
            sez[z + 38] = 1;
            sez[z + 39] = 1.2;
            sez[z + 40] = 1;
            sez[z + 41] = 1.1;
            sez[z + 82] = 1.4;
            sez[z + 40] = 1.2;
            sez[z + 123] = 1.1;
            sez[z + 83] = 1.2;
            sez[z + 81] = 1.2;
            sez[z + 40] = 1.0;
            sez[z + 42] = 1.0;
            sez[z + 122] = 1.0;
            sez[z + 124] = 1.0;
        } else if (haveL(rx, ry)) {
            sez[z - 1] = 1.2;
            sez[z - 2] = 1.4;
            sez[z - 3] = 1.2;
            sez[z - 42] = 1;
            sez[z - 43] = 1.2;
            sez[z - 44] = 1;
            sez[z + 38] = 1;
            sez[z + 39] = 1.2;
            sez[z + 40] = 1;
        } else if (haveB(rx, ry)) {
            sez[z + 41] = 1.2;
            sez[z + 82] = 1.4;
            sez[z + 123] = 1.0;
            sez[z + 83] = 1.2;
            sez[z + 81] = 1.2;
            sez[z + 40] = 1.0;
            sez[z + 42] = 1.0;
            sez[z + 122] = 1.0;
            sez[z + 124] = 0.5;
        }
        sez.forEach(editGround);
    }

    function editGround(v, i) {
        groundGeo.vertices[i].z = v * (1.1 * (Math.random() + 0.9));
    }

    function haveBL(rx, ry) {
        return ($.inArray((rx - 1) * 1024 + (ry - 1), blokHills) > -1);
    }

    function haveB(rx, ry) {
        return ($.inArray(rx * 1024 + (ry - 1), blokHills) > -1);
    }

    function haveL(rx, ry) {
        return ($.inArray((rx - 1) * 1024 + ry, blokHills) > -1);
    }

    // MODEL - FOREST

    function countTrees() {
        for (var i = 0; i < actualRequest.length; i++) {
            if (actualRequest[i][2] == 2) {
                treesForInstance.push([actualRequest[i][0], actualRequest[i][1]]);
            }
        }
    }

    function placeTree() {
        var object = tt1.scene.children[0].children[0];

        var faceMaterial = new THREE.MeshStandardMaterial();
        var scale = 0.8 + (0.25 * Math.random());
        //faceMaterial.materials[0].shininess = 5;
        //faceMaterial.materials[1].shininess = 0;
        mesh = new THREE.Mesh(object.geometry, faceMaterial);
        //mesh.rotation.x = -0.58;
        //mesh.rotation.z = 0.09;
        mesh.scale.set(scale, scale, scale);
        //mesh.rotation.y = 0.3 * Math.random() - (0.3 * Math.random());
        mesh.castShadow = true;
        mesh.position.x = (1 * 5) + 1 - (3 * Math.random());
        mesh.position.z = (-0 * 5) + 1 - (3 * Math.random());
        scene.add(mesh);
    }

    function makeForest(tree, blockPosition) {
        var object = tree;
        var vlength = object.geometry.vertices.length;
        var faces = object.geometry.faces;
        var cvertices = object.geometry.vertices;
        var flength = object.geometry.faces.length;
        var instances = treesForInstance.length;
        var material;
        //var instances = 2500;

        // make instances
        var geometry = new THREE.InstancedBufferGeometry();
        geometry.maxInstancedCount = instances;
        var vertices = new THREE.BufferAttribute(new Float32Array(flength * 3 * 3), 3);
        for (var i = 0; i < flength; i++) {
            vertices.setXYZ(i * 3, cvertices[faces[i].a].x, cvertices[faces[i].a].y, cvertices[faces[i].a].z);
            vertices.setXYZ(i * 3 + 1, cvertices[faces[i].b].x, cvertices[faces[i].b].y, cvertices[faces[i].b].z);
            vertices.setXYZ(i * 3 + 2, cvertices[faces[i].c].x, cvertices[faces[i].c].y, cvertices[faces[i].c].z);
        }
        geometry.addAttribute('position', vertices);

        // set colors
        var color = new THREE.BufferAttribute(new Float32Array(flength * 3 * 3), 3);
        var materials = object.material.materials;
        for (var i = 0; i < flength; i++) {
            color.setXYZ(i * 3, materials[faces[i].materialIndex].color.r, materials[faces[i].materialIndex].color.g,materials[faces[i].materialIndex].color.b);
            color.setXYZ(i * 3 + 1, materials[faces[i].materialIndex].color.r, materials[faces[i].materialIndex].color.g,materials[faces[i].materialIndex].color.b);
            color.setXYZ(i * 3 + 2, materials[faces[i].materialIndex].color.r, materials[faces[i].materialIndex].color.g,materials[faces[i].materialIndex].color.b);
        }
        geometry.addAttribute('color', color);

        // set positions
        var offsets = new THREE.InstancedBufferAttribute(new Float32Array(instances * 3), 3, 1);
        for (var i = 0, ul = (offsets.count); i < ul; i++) {
            offsets.setXYZ(i,(treesForInstance[i][0] * 5) + 2 - (4 * Math.random()), -0.2 * Math.random() - 1.9, (-treesForInstance[i][1] * 5 ) + 2 - (4 * Math.random()));
        }
        geometry.addAttribute('offset', offsets);

        // set shading
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();

        // set shaders
        material = new THREE.RawShaderMaterial({
            uniforms: {
                light: {value: dirLight.position},
                time : {value: Math.random()},
                dirColor : {value: dirLight.color},
                dirIntensity: {value: dirLight.intensity},
                hemiIntensity: {value: hemiLight.intensity}
            },
            vertexShader: document.getElementById('vst1').textContent,
            fragmentShader: document.getElementById('fst1').textContent,
            depthTest: true,
            depthWrite: true
        });

        var mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;

        if(tree == models.t1){
            tt1i.push(mesh);
        } else if(tree == models.t2){
            tt2i.push(mesh);
        }
        scene.add(mesh);
    }

    // MODEL - WATER

    function makeWaterMaterial(){
        waterMaterial = new THREE.RawShaderMaterial({
            uniforms: {
                light: {value: dirLight.position},
                time : {value: Math.random()},
                dirColor : {value: dirLight.color},
                dirIntensity: {value: dirLight.intensity},
                hemiIntensity: {value: hemiLight.intensity}
            },
            vertexShader: document.getElementById('vsw1').textContent,
            fragmentShader: document.getElementById('fst1').textContent,
            shading: THREE.FlatShading,
            transparent: true
        });
    }

    function makeWaterBlock(x, y) {
        var waterGeo = new THREE.PlaneGeometry(5, 5, 4, 4);
        var ground = new THREE.Mesh(waterGeo, waterMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.x = x * 5 + (blokx * 50);
        ground.position.y = -2.25;
        ground.position.z = y * -5 + (bloky * -50);
        scene.add(ground);
    }

    function makeWater(el, rx, ry){
        // todo: ?
        var rp = (ry * 164) - ((rx + 0) * 4) - 1 + 41;
        var z = 1600 - rp, sez = [];
        sez[z] = -1.5;
        sez[z - 1] = -1.1;
        sez[z + 1] = -1.1;
        sez[z + 41] = -1.1;
        sez[z - 41] = -1.1;
        sez[z + 42] = -0.5;
        sez[z - 42] = -0.5;
        sez[z - 40] = -0.2;
        sez[z - 40] = -0.2;
        sez.forEach(editGround);
        makeWaterBlock(rx, ry);
    }

    // MODEL - CITY / ZONE

    function makeLine(el){
        var line = new THREE.Shape();
        if(el[10] == 1){
            line.moveTo(2.45, 2.45);
            line.lineTo(2.45, -2.45);
        }
        else if(el[10] == 2){
            line.moveTo(2.45, 2.45);
            line.lineTo(-2.45, 2.45);
        }
        else if(el[10] == 3){
            line.moveTo(-2.45, 2.45);
            line.quadraticCurveTo(2.45, 2.45, 2.45, -2.45);
        }
        else if(el[10] == 4){
            line.moveTo(- 2.45,- 2.45);
            line.lineTo(- 2.45, 2.45);
        }
        else if(el[10] == 5){
            line.moveTo(0, 0);
            var e1 = el;
            e1[10] = 1;
            makeLine(e1);
            var e2 = el;
            e2[10] = 4;
            makeLine(e2);
        }
        else if(el[10] == 6){
            line.moveTo(-2.45,-2.45);
            line.quadraticCurveTo(-2.45, 2.45, 2.45, 2.45);
        }
        else if(el[10] == 7){
            line.moveTo(-2.45,-2.45);
            line.quadraticCurveTo(-2.45, 2.45, 0, 2.45);
            line.quadraticCurveTo(2.45, 2.45, 2.45, -2.45);
        }
        else if(el[10] == 8){
            line.moveTo(-2.45,-2.45);
            line.lineTo(2.45,- 2.45);
        }
        else if(el[10] == 9){
            line.moveTo(-2.45,-2.45);
            line.quadraticCurveTo(2.45, -2.45, 2.45, 2.45);
        }
        else if(el[10] == 10){
            line.moveTo(0, 0);
            var e1 = el;
            e1[10] = 2;
            makeLine(e1);
            var e2 = el;
            e2[10] = 8;
            makeLine(e2);
        }
        else if(el[10] == 11){
            line.moveTo(-2.45,-2.45);
            line.quadraticCurveTo(2.45, -2.45, 2.45, 0);
            line.quadraticCurveTo(2.45, 2.45, -2.45, 2.45);
        }
        else if(el[10] == 12){
            line.moveTo(2.45,-2.45);
            line.quadraticCurveTo(-2.45, -2.45, -2.45, 2.45);
        }
        else if(el[10] == 13){
            line.moveTo(2.45,2.45);
            line.quadraticCurveTo(2.45, -2.45, 0, -2.45);
            line.quadraticCurveTo(-2.45, -2.45, -2.45, 2.45);
        }
        else if(el[10] == 14){
            line.moveTo(2.45,2.45);
            line.quadraticCurveTo(-2.45, 2.45, -2.45, 0);
            line.quadraticCurveTo(-2.45, -2.45, 2.45, -2.45);
        }
        else if(el[10] == 15){
            line.moveTo(0,2.45);
            line.quadraticCurveTo(2.45, 2.45, 2.45, 0);
            line.quadraticCurveTo(+2.45, -2.45, 0, -2.45);
            line.quadraticCurveTo(-2.45, -2.45, -2.45, 0);
            line.quadraticCurveTo(-2.45, 2.45, 0.04, 2.45);
        }
        if(el[10] < 16 && el[10] != 0){
            var points = line.createPointsGeometry();
            if(el[8] == mujStat){
                var myBorderMaterial = new THREE.LineBasicMaterial({color: h > 20 || h < 6 ? 0x050555 : 0x2222ee, opacity: 0.6, transparent: true});
                var border = new THREE.Line(points, myBorderMaterial);
                border.position.y = 0.1;
                border.position.x = el[0] * 5;
                border.position.z = -(el[1] * 5);
                border.rotation.set(1.57, 0, 0);
                myLines.add(border);
                var shborder = new THREE.Line(points, new THREE.LineBasicMaterial({color: 0x2222bb, opacity: 0.4, transparent: true}));
                shborder.position.x = el[0] * 5;
                shborder.position.y = -0.05;
                shborder.position.z = -(el[1] * 5);
                shborder.rotation.set(1.57, 0, 0);
                myLines.add(shborder);
                var shborder = new THREE.Line(points, new THREE.LineBasicMaterial({color: 0x222222, opacity: 0.3, transparent: true}));
                shborder.position.x = el[0] * 5;
                shborder.position.y = -0.2;
                shborder.position.z = -(el[1] * 5);
                shborder.rotation.set(1.57, 0, 0);
                myLines.add(shborder);
            } else{
                var intensity = h > 20 || h < 5 ? 0.5 : 1;
                var enemyColor = new THREE.Color(1 * intensity, el[8]*51%21/51 * intensity, el[8]*51%21/51 * intensity);
                var otherBorderMaterial = new THREE.LineBasicMaterial({color: enemyColor, opacity: 0.5, transparent: true});
                var border = new THREE.Line(points, otherBorderMaterial);
                var shborder = new THREE.Line(points, new THREE.LineBasicMaterial({color: 0x222222, opacity: 0.3, transparent: true}));
                border.position.x = el[0] * 5;
                border.position.z = -(el[1] * 5);
                border.rotation.set(1.57, 0, 0);
                stateLines.add(border);
                shborder.position.x = el[0] * 5;
                shborder.position.y = -0.2;
                shborder.position.z = -(el[1] * 5);
                shborder.rotation.set(1.57, 0, 0);
                stateLines.add(shborder);
            }
        }
    }

    function placeVillage(el) {
        var size = 'xl';
        if(el[6] < 20){
            size = 'xs';
        } else if(el[6] < 50){
            size = 's';
        } else if(el[6] < 80){
            size = 'm';
        } else if(el[6] < 115){
            size = 'l';
        }
        var build = models['c'+size];
        var materials = clone(build.material.materials);
        materials[2].shininess = 10;
        if(el[8] == mujStat){
            materials[0] = myStateColor;
            materials[2] = myStateColor;
        } else {
            materials[0] = otherStateColor;
            materials[2] = otherStateColor;
        }
        var faceMaterial = new THREE.MultiMaterial(materials);
        mesh = new THREE.Mesh(build.geometry, faceMaterial);
        //mesh.rotation.y = 0.5 * Math.random() - (0.5 * Math.random());
        mesh.castShadow = true;
        mesh.recieveShadow = true;
        mesh.position.x = el[0] * 5 + 0.2;
        mesh.position.z = -el[1] * 5 + 0.1;
        mesh.scale.set(0.7, 7, 0.70);
        mesh.position.y = -2.04;
        mesh.rotation.y = Math.sin((el[0] * 2) + (el[1] * 4) % 50) * 3.14;
        scene.add(mesh);
        //if(h > 20 || h < 6){
        var light = new THREE.PointLight(0xaabb22, 1, 4, 2);

        light.position.x = el[0] * 5;
        light.position.z = -el[1] * 5;
        //light.castShadow = true;
        cityLights.add(light);
        //}
    }

    function clone(obj) {
        if (null == obj || "object" != typeof obj) return obj;
        var copy = obj.constructor();
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
        }
        return copy;
    }

}