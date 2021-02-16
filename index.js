const RootPath = process.cwd();
const Path = require('path');
const Fs = require('fs');
const Request = require('./request');
const Log = require('@ijstech/log');
var Options = {};

function getFullPath(root, ...paths){    
    let rootPath = root;
    if (rootPath.slice(-1) != '/')
        rootPath += '/'
    let result = root;    
    if (Array.isArray(paths)){
        for (var i = 0; i < paths.length; i ++){
            result = Path.join(result, paths[i])
            if (result.indexOf(rootPath) != 0)
                return;
        }        
        return result
    }    
    else
        return;
}
function getScript(module){    
    let result = '';    
    if (module.reference){
        for (let i = 0; i < module.reference.length; i ++)
            result += getScript(module.reference[i]);
    }
    result += module.script || ''
    return result;
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
            result = JSON.parse(result)
        
        return {
            require: result.requiredModules,
            script: getScript(result)
        }
    }
    catch(err){        
        Log.error(err);
        return;
    }
}
async function getModuleCode(config, moduleId){
    try{        
        let result = await Request.post(config.host, {
            path: moduleId,
            token: config.token,
            code: true
        });        
        if (typeof(result) == 'string')
            return JSON.parse(result).code
        else if (typeof(result) == 'object')
            return result.code
    }
    catch(err){        
        Log.error(err);
        return;
    }
}
function readLocalFile(filePath){
    return new Promise(function(resolve, reject){
        if (!filePath)
            reject('$invalid_file_path');
        Fs.readFile(filePath, 'utf8', function(err, content){
            if (err)
                reject(err)
            else
                resolve(content);
        });
    })
}
function getRequiredModules(localPath, modules, requiredModules, result, idx){
    result = result || [];
    idx = idx || [];
    return new Promise(async function(resolve){
        try{
            for (var i = 0; i < requiredModules.length; i ++){
                var path = requiredModules[i].toLowerCase();                
                if (idx.indexOf(path) < 0){
                    idx.push(path);
                    var pack = modules[path.toLowerCase()];
                    if (pack && pack.id){
                        var fullPath = getFullPath(localPath, pack.id)                        
                        try{
                            var data = JSON.parse(await readLocalFile(fullPath));
                            if (data){
                                if (data.requiredModules)
                                    await getRequiredModules(localPath, modules, data.requiredModules, result, idx)
                                if (pack.id.indexOf('/') > 0)                        
                                    var id = pack.id.split('/')[1]
                                else
                                    var id = pack.id;                                
                                result.push({
                                    id: id,
                                    name: data.moduleName,                                
                                    script: data.es6 || data.compiledScript
                                })
                            }     
                        }
                        catch(err){
                            Log.error(err);
                        }       
                    }                    
                }
            }
        }
        catch(err){
            Log.error(err);
        }
        resolve(result)        
    })   
}
function _plugin(vm, ctx, site, config){         
    let localPath = Path.resolve(RootPath, config.localPath);            
    vm.injectGlobalObject('_$$plugin_module', {
        $$getScriptByPath: true,
        getScriptByPath: async function(path){            
            return new Promise(async function(resolve, reject){
                try{
                    let modules = site.modules
                    var pack = modules[path.toLowerCase()];                    
                    if (pack && pack.id){
                        if (pack.id.indexOf('/') > 0)                        
                            var id = pack.id.split('/')[1]
                        else
                            var id = pack.id;

                        var fullPath = getFullPath(localPath, pack.id)                        
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
                }
            })        
        },
        $$getCodeById: true,
        getCodeById: async function(id){
            return new Promise(async function(resolve, reject){
                try{
                    let modules = site.modules                    
                    for (var v in modules){
                        var pack = moduels[v];
                        if (pack.id == id || pack.id.indexOf('/' + id)){
                            if (pack.id.indexOf('/') > 0)                        
                                var id = pack.id.split('/')[1]
                            else
                                var id = pack.id;                            
                            var fullPath = getFullPath(localPath, pack.id)                        
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
                        }
                    }
                    resolve();
                }
                catch(err){
                    Log.error(err);
                    resolve()
                }
            })        
        },
        $$getModule: true,
        getModule: async function(pacakgeId, moduleId){
            return new Promise(async function(resolve, reject){
                try{
                    let fullPath = getFullPath(localPath, pacakgeId, moduleId)                    
                    let data = await readLocalFile(fullPath);
                    resolve(data);
                }
                catch(err){
                    Log.error(err);
                    reject(err);
                }                                
            })
        },
        $$getPackage: true,
        getPackage: async function(pacakgeId, moduleId){
            return new Promise(async function(resolve, reject){
                try{
                    let fullPath = getFullPath(localPath, pacakgeId, moduleId)                    
                    let data = await readLocalFile(fullPath);                    
                    resolve(JSON.parse(data).code);
                }
                catch(err){
                    Log.error(err);
                    reject(err);
                }                                
            })
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
                    return {}
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
                }                
            },
            getPackage: async function(packageId, moduleId){                          
                try{
                    var result = await _$$plugin_module.getPackage(packageId, moduleId);
                    return result;
                }
                catch(err){
                }                
            },
            updateModule: async function(packageId, moduleId, content){
                try{
                    var result = await _$$plugin_module.updateModule(packageId, moduleId, content);
                    return result;
                }
                catch(err){

                }
            }
        }
    } + ';init()');
}
function getLocalPackagePath(name){
    let path;
    try{
        path = Path.dirname(require.resolve(name + '/package.json'));
    }
    catch(err){
        try{
            path = Path.dirname(require.resolve(RootPath + '/node_modules/' + name + '/package.json'))
        }
        catch(err){}        
    }
    return path;
}
var Cache = {};
module.exports = {
    _init: function(options){   
        Options = options;
        this.options = options        
    },
    getLocalPackagePath: getLocalPackagePath,
    getPackage: async function(name, pack){
        try{
            if (pack.liveUpdate){
                let data = await getModuleCode(this.options.updateServer, pack.id);
                return JSON.parse(data);
            }
            else{        
                
                let path = getLocalPackagePath(name);
                return require.main.require(name);             
            }
        }
        catch(err){
            Log.error(err);
        }
    },
    getModuleScript: async function(package, module){        
        try{     
            if (!package){
                if (Cache[module.file])
                    return Cache[module.id];
                let localPath = getFullPath(RootPath, module.file);
                let localScript = await readLocalFile(localPath);
                Cache[module.file] = {
                    require: [],
                    script: localScript
                };
                return Cache[module.file]
            }     
            else if (package.liveUpdate){
                if (package.cache && Cache[module.id])
                    return Cache[module.id];
                let data = await getRemoteModuleScript(this.options.updateServer, module.id)
                if (package.cache)
                    Cache[module.id] = data;
                return data
            }
            else{          
                if (Cache[module.id])
                    return Cache[module.id];
                let packPath = getLocalPackagePath(package.name);               
                let script = '';  
                for (let i = 0; i < module.scriptPath.length; i ++){
                    let name = module.scriptPath[i];                    
                    if (name.substr(name.length - 4) == '.pdm' && module.require.indexOf('@ijstech/pdm') < 0)
                        module.require.push('@ijstech/pdm')
                    let path = getFullPath(packPath, name);
                    script += (await readLocalFile(path))
                }  
                let result = {
                    require: module.require,
                    script: script
                };
                Cache[module.id] = result;
                return result;
            }
        }
        catch(err){
            Log.error(err);
        }
    },
    getModuleCode: getModuleCode
}