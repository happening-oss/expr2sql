declare class Go {
	importObject: any;
	run(instance: WebAssembly.Instance): Promise<any>;
};