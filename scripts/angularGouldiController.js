var gouldi = angular.module('gouldiApp');

gouldi.controller(
    'GouldiMainController',
    ['$scope', '$routeParams', '$timeout', 'gouldiCookieService', 'gouldiHttpServices',
        function ($scope, $routeParams, $timeout, gouldiCookieService, gouldiHttpServices) {
        var pleaseWait = false;
        $scope.commitMessage = " ";

        var init = function(){
            gouldiHttpServices
                .initScripts( $scope )
                .then( function(){
                    console.log("Finished loading process. Init cookies and load actual model.");
                    $scope.readModel();
                    gouldiCookieService.initCookies( $scope.modelrepo );
                    $scope.max = $scope.schema.properties.qID.maximum;
                    $scope.min = $scope.schema.properties.qID.minimum;
                    gouldi.pleaseWaitALittle = false;
            });
        };

        init();

        $scope.onRequest = function (form){
            $scope.$broadcast('schemaFormValidate');

            // Then we check if the form is valid
            if ( form.$valid ) {
                $scope.readModel();
            }
        };

        $scope.updated = function () {
            var scriptTag = document.createElement('script');
            scriptTag.setAttribute('src', 'widgets/formula-ast-widget.js');
            scriptTag.setAttribute('mathml', $scope.model.correct_mml);

            var container = document.getElementById("ast");
            container.innerHTML = "";
            container.appendChild(scriptTag);
        };

        $scope.setID = function(){
            $scope.readModel($scope.form);
        };

        $scope.changeID = function( newID ){
            if ( newID < $scope.min || $scope.max < newID ) return;
            $scope.model.qID = newID;
            $scope.readModel();
        }

        $scope.previousID = function( model ){
            $scope.changeID( model.qID-1 )
        };

        $scope.nextID = function(model){
            $scope.changeID( model.qID+1 )
        };

        $scope.readModel = function () {
            var id = $scope.model.qID;
            var githubReq = $scope.modelrepo;

            gouldiHttpServices.modelRequest( id, githubReq )
                .then( function (res) {
                    $scope.model = res.data;
                    $scope.model.qID = id;

                    if ( !('constraints' in $scope.model) )
                        $scope.model.constraints = [];

                    $scope.updated();
                }).then( function(){
                    $scope.logger("Loaded ID: " + id, 'alert-info');
                }).catch( function(err) {
                    $scope.logger(err, 'alert-danger');
            });
        };

        $scope.disableTokenError = function(){
            $scope.$broadcast(
                'schemaForm.error.token',
                'necessaryToken',
                true,
                'repo'
            );
        };

        $scope.generateMathML = function(semantic_tex){
            if ( semantic_tex === "" ) {
                console.log("Empty semantic tex");
                return;
            }

            gouldiHttpServices.latexmlRequest(semantic_tex)
                .then( function(res) {
                    console.log("Created MML!");
                    $scope.model.correct_mml = res.data;
                    $scope.updated();
                    $scope.logger("Successfully created MML!", "alert-success");
                }).catch( function(e) {
                    $scope.logger(e.message, 'alert-danger');
                });
        };

        $scope.broadcastingTest = function(){
            if ( $scope.modelrepo.token === "" ){
                $scope.$broadcast(
                    'schemaForm.error.token',
                    'necessaryToken',
                    'An access token is necessary to push changes to GitHub!',
                    'repo'
                );
                // First we broadcast an event so all fields validate themselves
                $scope.$broadcast('schemaFormValidate');
                $scope.activeForm = 1;
                $scope.logger("Missing Access Token", 'alert-warning');
                return -1;
            } else {
                $scope.$broadcast(
                    'schemaForm.error.token',
                    'necessaryToken',
                    true,
                    'repo'
                );
                // First we broadcast an event so all fields validate themselves
                $scope.$broadcast('schemaFormValidate');
                return 0;
            }
        };

        $scope.onSave = function(form) {
            var returnValue = $scope.broadcastingTest();
            if ( returnValue < 0 ) return;

            // Then we check if the form is valid
            if (form.$valid) {
                gouldiHttpServices.writeModelRequest($scope.modelrepo, $scope.model)
                    .then(function (res) {
                        $scope.logger(res, 'alert-success');
                    }).catch(function (jsonError) {
                        jsonError.config.data = " ... ";
                        $scope.readModel();
                        $scope.logger(jsonError, 'alert-danger');
                    });
            }
        };

        const cssColorSettings = [
            '#3c763d', // success text color
            '#d6e9c6', // success border color
            '#dff0d8', // success background color
            '#31708f', // info text color IDX=3
            '#bce8f1', // info border color
            '#d9edf7', // info background color
            '#8a6d3b', // warning text color IDX=6
            '#faebcc', // warning border color
            '#fcf8e3', // warning background color
            '#a94442', // danger text color IDX=9
            '#ebccd1', // danger border color
            '#f2dede', // danger background color
        ];

        $scope.logger = function( msg, alert ){
            var help = document.getElementById("logger-info-helper");
            if ( help !== null ){
                help.setAttribute( 'class', "alert " + alert );
                help.innerHTML = JSON.stringify(msg, null, 2);
            }
            var panelDiv = document.getElementById("logger-info-panel").firstChild;
            var defaultIdx = 0; // alert-info level
            if ( alert === 'alert-info' )
                defaultIdx = 3;
            else if ( alert === 'alert-warning')
                defaultIdx = 6;
            else if ( alert === 'alert-danger' )
                defaultIdx = 9;
            panelDiv.style.color = cssColorSettings[defaultIdx];
            panelDiv.style.borderColor = cssColorSettings[defaultIdx+1];
            panelDiv.style.backgroundColor = cssColorSettings[defaultIdx+2];

        };

        $scope.$on('$routeChangeSuccess', function() {
            console.log("Well, routing changed");
            try {
                var possibleNum = parseInt($routeParams.qid);
                if (possibleNum >= $scope.min &&
                    possibleNum <= $scope.max) {
                    // TODO wow... timeout...
                    $timeout( function(){
                        $scope.model.qID = parseInt($routeParams.qid);
                        $scope.readModel();
                    }, 100 );
                }
            } catch ( err ) {
                console.log("I don't care... " + err);
            }
        });

        $scope.$watch('modelrepo.token', function(){
            if ( 'modelrepo' in $scope ){
                gouldiCookieService.update( $scope.modelrepo );
            }
        });

        $scope.$watch('model.math_inputtex', function(){
            if ( !('model' in $scope) || !$scope.model.math_inputtex ){
                return;
            }

            var container = document.getElementById('svg-renderer-container');
            var parentContainer = container.parentNode;
            container.innerHTML = "";

            gouldiHttpServices.renderMathRequest($scope.model.math_inputtex)
                .then( function(res){
                    container.innerHTML = res.data;
                    parentContainer.setAttribute('class', "alert alert-success math-renderer");
                }).catch( function(e){
                    console.log("ERROR: " + e.data);
                    parentContainer.setAttribute('class', "alert alert-danger math-renderer");
                });
        }, true);

        $scope.$watch('model', function(){
            var model_help = document.getElementById("model-info-helper");
            if ( model_help !== null )
                model_help.innerHTML = JSON.stringify($scope.model, null, 2);
        }, true);

        console.log("Finish instantiation of controller!");
    }]);
