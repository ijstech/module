const RootPath = process.cwd();
const Path = require('path');
const Fs = require('fs');
const Request = require('./request');
const Log = require('@ijstech/log');
var Options = {};

function getFullPath(root, ...paths){    
    let rootPath = root;
    if (rootPath.slice(-1) != '/')
        rootPath += '/';
    let result = root;    
    if (Array.isArray(paths)){
        for (var i = 0; i < paths.length; i ++){
            result = Path.join(result, paths[i]);
            if (result.indexOf(rootPath) != 0)
                return;
        }        
        return result;
    }    
    else
        return;
};
function resolveFullPath(...paths){    
    let p = paths[0];    
    for (let i = 1; i < paths.length; i ++){
        if (Array.isArray(paths[i])){
            let result = [];
            for (let k = 0; k < paths[i].length; k ++){
                result.push(Path.join(p, paths[i][k]))
            }
            for (let k = 0; k < result.length; k++){
                if (result[k].indexOf(p) != 0)
                    return
            }
            return result;
        }
        else{
            let result = Path.join(p, paths[i]);
            if (result.indexOf(p) == 0)
                p = result
            else
                return
        }
    }
    return p;
}
async function getRemoteModuleScript(config, moduleId){    
    try{
        var result = await Request.post(config.host, {
            path: moduleId,
            token: config.token,        
            script: true,
            code: true
        });        
        if (typeof(result) == 'string')
            result = JSON.parse(result);        
        return {
            form: result.form,
            moduleName: result.moduleName,
            className: result.className,
            require: result.requiredModules,
            script: getScript(result)
        };
    }
    catch(err){        
        Log.error(err);
        return;
    };
};
async function getModuleCode(module){        
    try{        
        if (Options.localPath && module.orgId){
            let path
            if (module.orgId){
                let id;
                if (module.id.indexOf('/') > 0)                
                    id = module.id.split('/')[1]
                else
                    id = module.id;
                path = getFullPath(RootPath, Options.localPath, module.orgId, id);            
            }
            else
                path = getFullPath(RootPath, Options.localPath, module.id);                        
            let file = await readLocalFile(path);
            if (file){                
                let code = JSON.parse(file).code;                     
                return code;
            }            
        }
        if (Options.storage){

        }
        else if (Options.updateServer){
            let result = await Request.post(Options.updateServer.host, {
                path: module.id,
                token: Options.updateServer.token,
                code: true
            });        
            if (typeof(result) == 'string')
                return JSON.parse(result).code;
            else if (typeof(result) == 'object')
                return result.code;
        };
    }
    catch(err){        
        Log.error(err);
        return;
    };
};
function readLocalFile(filePath){
    return new Promise(function(resolve, reject){
        if (!filePath)
            reject('$invalid_file_path');
        Fs.readFile(filePath, 'utf8', function(err, content){
            if (err)
                reject(err);
            else
                resolve(content);
        });
    });
};

function _plugin_(vm, ctx, site, config){         
    let localPath = Path.resolve(RootPath, config.localPath);            
    vm.injectGlobalObject('_$$plugin_module', {
        $$getScriptByPath: true,
        getScriptByPath: async function(path){            
            return new Promise(async function(resolve, reject){
                try{
                    let modules = site.modules;
                    var pack = modules[path.toLowerCase()];                    
                    if (pack && pack.id){
                        if (pack.id.indexOf('/') > 0)                        
                            var id = pack.id.split('/')[1];
                        else
                            var id = pack.id;

                        var fullPath = getFullPath(localPath, pack.id);
                        var data = JSON.parse(await readLocalFile(fullPath));    
                        var reference = await getRequiredModules(localPath, modules, data.requiredModules);                        
                        resolve(JSON.stringify({
                            file: {
                                id: id
                            },
                            reference: reference,
                            moduleName: data.moduleName,
                            className: data.className,
                            script: data.es6 || data.compiledScript,
                            form: data.form
                        }));
                    }
                    else
                        resolve();
                }
                catch(err){
                    Log.error(err);
                    resolve()
                };
            });    
        },
        $$getCodeById: true,
        getCodeById: async function(id){
            return new Promise(async function(resolve, reject){
                try{
                    let modules = site.modules;                    
                    for (var v in modules){
                        var pack = modules[v];
                        if (pack.id == id || pack.id.indexOf('/' + id)){
                            if (pack.id.indexOf('/') > 0)                        
                                var id = pack.id.split('/')[1];
                            else
                                var id = pack.id;                            
                            var fullPath = getFullPath(localPath, pack.id);
                            var data = JSON.parse(await readLocalFile(fullPath));                            
                            resolve(JSON.stringify({
                                file: {
                                    id: id
                                },                                
                                moduleName: data.moduleName,
                                className: data.className,
                                code: data.code,
                                script: data.es6 || data.compiledScript,                                
                                form: data.form
                            }));
                        };
                    };
                    resolve();
                }
                catch(err){
                    Log.error(err);
                    resolve();
                };
            });    
        },
        $$getModule: true,
        getModule: async function(pacakgeId, moduleId){
            return new Promise(async function(resolve, reject){
                try{
                    let fullPath = getFullPath(localPath, pacakgeId, moduleId);                    
                    let data = await readLocalFile(fullPath);
                    resolve(data);
                }
                catch(err){
                    Log.error(err);
                    reject(err);
                };
            });
        },
        $$getPackage: true,
        getPackage: async function(pacakgeId, moduleId){
            return new Promise(async function(resolve, reject){
                try{
                    let fullPath = getFullPath(localPath, pacakgeId, moduleId);                    
                    let data = await readLocalFile(fullPath);                    
                    resolve(JSON.parse(data).code);
                }
                catch(err){
                    Log.error(err);
                    reject(err);
                };
            });
        },
        $$updateModule: true,
        updateModule: async function(pacakgeId, moduleId, content){
            return new Promise(function(resolve, reject){

            })
        }
    }, ''+ function init(){
        global.Plugins.Module = {
            getScriptByPath: async function(path){
                var result = await _$$plugin_module.getScriptByPath(path);
                if (result){
                    try{
                        return JSON.parse(result);
                    }
                    catch(err){                        
                        return {};
                    }                
                }
                else
                    return {};
            },
            getCodeById: async function(id){
                var result = await _$$plugin_module.getCodeById(id);
                return result;
            },
            getModule: async function(packageId, moduleId){                
                try{
                    var result = await _$$plugin_module.getModule(packageId, moduleId);
                    return result;
                }
                catch(err){
                };
            },
            getPackage: async function(packageId, moduleId){                          
                try{
                    var result = await _$$plugin_module.getPackage(packageId, moduleId);
                    return result;
                }
                catch(err){
                };
            },
            updateModule: async function(packageId, moduleId, content){
                try{
                    var result = await _$$plugin_module.updateModule(packageId, moduleId, content);
                    return result;
                }
                catch(err){

                };
            }
        }
    } + ';init()');
};
function getLocalPackagePath(name){
    let path;
    try{
        path = Path.dirname(require.resolve(name + '/package.json'));
    }
    catch(err){
        try{
            path = Path.dirname(require.resolve(RootPath + '/node_modules/' + name + '/package.json'));
        }
        catch(err){};
    };
    return path;
};
var Cache = {};
async function getPackage(name, pack){
    try{
        if (pack && pack.liveUpdate){            
            let data = await getModuleCode(pack);
            data = JSON.parse(data);
            data.modules = data.modules || {};
            for (let v in data.modules)
                data.modules[v.toLowerCase()] = data.modules[v];
            return data;
        }
        else{
            let path = getLocalPackagePath(name);
            return require.main.require(name);
        }
    }
    catch(err){
        Log.error(err);
    };
};
function getScript(module){
    if (!module.es6 && !module.script) 
        return '';
    let result = '';       
    if (module.reference){
        for (let i = 0; i < module.reference.length; i ++){
            let ref = module.reference[i];
            result += getScript(ref);
        }
    };
    result += module.es6 || module.script || '';
    if (module.path && module.path.slice(-3) == '.ts'){
        let path = module.path.toLowerCase();        
        path = path.substring(0, path.length -3);
        result += 
`if (module && module.exports){
    module.paths['${path}'] = module.exports;
    module.exports = null;    
}`
    };
    return result;
};
async function getModuleScript(package, module){
    try{     
        if (!package){
            if (Cache[module.file])
                return Cache[module.file];
            let localPath = getFullPath(RootPath, module.file);
            let localScript = await readLocalFile(localPath);
            Cache[module.file] = {
                require: [],
                script: localScript
            };
            return Cache[module.file];
        }     
        else if (package.liveUpdate){            
            if (package.cache && Cache[package.id + '/' + module.id])
                return Cache[package.id + '/' + module.id];  
            let data;
            if (Options.localPath && package.orgId){
                let moduleData = await getModule(package.orgId, module);
                if (moduleData.requiredModules && moduleData.requiredModules.length > 0){
                    let pack = await getPackage(package.name, package);
                    moduleData.reference = await getRequiredModules(package, pack.modules, moduleData.requiredModules);     
                };
                let script = getScript(moduleData);                
                data = {
                    form: moduleData.form,
                    moduleName: moduleData.moduleName,
                    className: moduleData.className,
                    require: moduleData.requiredModules,
                    script: script
                };
            }       
            else
                data = await getRemoteModuleScript(Options.updateServer, module.id);            
            if (package.cache)
                Cache[package.id + '/' + module.id] = data;
            return data;
        }
        else{
            if (Cache[package.id + '/' + module.id])
                return Cache[package.id + '/' + module.id];
            let packPath = getLocalPackagePath(package.name);               
            let script = '';  
            for (let i = module.scriptPath.length -1; i > -1; i--){
                let name = module.scriptPath[i];
                if (name.substr(name.length - 4) == '.pdm' && module.require.indexOf('@ijstech/pdm') < 0)
                    module.require.push('@ijstech/pdm');
                let path = getFullPath(packPath, name);                
                script += (await readLocalFile(path));
                if (name.slice(-3) == '.js'){                    
                    path = name.substring(0, name.length -3);
                    if (path.substring(0,2) == './')
                        path = path.substring(1);
                    script += 
                        `if (module && module.exports){
                            module.paths['${path}'] = module.exports;
                            module.exports = null;    
                        }`
                }
            };
            let result = {
                require: module.require,
                script: script
            };
            Cache[package.id + '/' + module.id] = result;
            return result;
        }
    }
    catch(err){
        Log.error(err);
    };
};
async function getRequiredModules(package, modules, requiredModules, result, idx){
    result = result || [];
    idx = idx || {};
    try{
        for (var i = 0; i < requiredModules.length; i ++){
            var path = requiredModules[i].toLowerCase(); 
            if (!idx[path]){
                idx[path] = true;
                let module = modules[path];
                if (module && module.id){
                    let id;
                    let fullPath;
                    if (package.orgId){
                        if (module.id.indexOf('/') > 0)
                            id = module.id.split('/')[1];
                        else
                            id = module.id;
                        fullPath = getFullPath(RootPath, Options.localPath, package.orgId, id);
                    }
                    else{
                        fullPath = getFullPath(RootPath, Options.localPath, module.id);
                    };
                    try{
                        let data = JSON.parse(await readLocalFile(fullPath));
                        if (data){
                            if (data.requiredModules)
                                await getRequiredModules(package, modules, data.requiredModules, result, idx);                            
                            result.push({
                                id: id,
                                name: data.moduleName,                                
                                script: data.es6 || data.compiledScript
                            });
                        };
                    }
                    catch(err){
                        Log.error(err);
                    };  
                };               
            };
        };
    }
    catch(err){
        Log.error(err);
    }
    return result;
};
async function getModule(orgId, module){
    try{
        let id;        
        if (module.id.indexOf('/') > 0){
            id = module.id.split('/')[1];
        }
        else{
            id = module.id;
        };
        return getModuleById(orgId, id);
    }
    catch(err){
        Log.error(err);
    };
};
async function getModuleById(orgId, moduleId){    
    try{
        let fullPath;
        if (orgId){
            fullPath = getFullPath(RootPath, Options.localPath, orgId, moduleId);
        }
        else{
            fullPath = getFullPath(RootPath, Options.localPath, moduleId);
        };
        let data = JSON.parse(await readLocalFile(fullPath));    
        data.id = moduleId;
        return data;
    }
    catch(err){
        Log.error(err);
    };
};
async function getScriptByPath(site, package, path){
    try{
        path = path.toLowerCase();        
        let pack = await getPackage(package.name, package);
        let module;
        for (var v in pack.modules){
            if (v.toLowerCase() == path){
                module = pack.modules[v.toLowerCase()];
                break;
            };
        };
        let data;        
        if (module)
            data = await getModule(package.orgId, module);
        else{
            module = site.modules[path];
            if (module)
                data = await getModule(module.orgId, module);
        };
        if (data){
            let reference = await getRequiredModules(package.orgId, pack.modules, data.requiredModules);        
            return {
                file: {
                    id: data.id
                },
                reference: reference,
                moduleName: data.moduleName,
                className: data.className,
                script: data.es6 || data.compiledScript,
                form: data.form
            };
        };
    }
    catch(err){      
        Log.error(err);  
    };
};
function _plugin(vm, ctx, site, config) {
	vm.injectGlobalObject('_$$plugin_module', {
        $$getScriptByPath: true,
        getScriptByPath: async function(path){
            let script = await getScriptByPath(site, ctx.package, path);        
            return JSON.stringify(script);
        },
        $$getPackage: true,
        getPackage: async function(orgId, packId){
            let result = await getModuleById(orgId, packId);
            return result.code;
        },
        $$getModule: true,
        getModule: async function(orgId, packId, moduleId){
            let result = await getModuleById(orgId, moduleId);            
            delete result.compiledScript;
            delete result.es6;
            return JSON.stringify(result);
        }
	}, '' + function init() {
		global.Plugins.Module = {
            getScriptByPath: async function(path){
                try{
                    let result = _$$plugin_module.getScriptByPath(path);
                    return JSON.parse(result);
                }
                catch(err){}                                
            },
            getPackage: async function(orgId, packId){
                try{
                    let result = await _$$plugin_module.getPackage(orgId, packId);
                    return JSON.parse(result);
                }
                catch(err){}
            },
            getModule: async function(orgId, packId, moduleId){
                try{
                    let result = await _$$plugin_module.getModule(orgId, packId, moduleId);
                    return JSON.parse(result);
                }
                catch(err){}                
            }
        }		
	} + ';init()')
};
function getLocalPackage(name){
    let package;
    let path;
    try{
        package = require(name);
        path = Path.dirname(require.resolve(name + '/package.json'));
    }
    catch(err){
        try{
            package = require(RootPath + '/node_modules/' + name);
            path = Path.dirname(require.resolve(RootPath + '/node_modules/' + name + '/package.json'));
        }
        catch(err){
            return Log.error('$package_not_found', {
                name: name
            });
        };
    };
    return {
        rootPath: path,
        default: package,
        plugin: package._plugin,
        middleware: package._middleware
    };
};
module.exports = {
    _init: function(options){   
        Options = options;
        this.options = options        
    },
    _plugin: _plugin,
    getLocalPackage: getLocalPackage,
    getLocalPackagePath: getLocalPackagePath,
    getPackage: getPackage,
    getModuleScript: getModuleScript,
    getModuleCode: getModuleCode,
    resolveFullPath: resolveFullPath
}