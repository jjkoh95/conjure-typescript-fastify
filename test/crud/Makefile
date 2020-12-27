conjureYAML := test.conjure.yaml
conjureIRJSON := test.conjure.json
conjureOutputDir := generated

conjure-compile-ir:
	conjure compile ${conjureYAML} ${conjureIRJSON}

conjure-typescript-generate:
	mkdir ${conjureOutputDir}
	conjure-typescript generate --rawSource ${conjureIRJSON} ${conjureOutputDir}
