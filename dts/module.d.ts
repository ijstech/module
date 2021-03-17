declare module Plugins.Module{
	function getScriptByPath(path: string, options?: any);	
	function getPackage(orgId: string, packId: string): Promise<any>;
	function getModule(orgId: string, packId: string, moduleId: string): Promise<any>;
}