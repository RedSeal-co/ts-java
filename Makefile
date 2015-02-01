.PHONY: install install-npm install-tsd install-tinkerpop lint documentation test testdata unittest cucumber compile
.PHONY: clean clean-obj clean-tsd clean-npm clean-js-map clean-unittest clean-cucumber clean-tinkerpop

default: test

all: install test documentation

lint:
	ls $(TS_SRC) | xargs -n1 node_modules/tslint/bin/tslint --config tslint.json --file

lintOut:
	node_modules/jshint/bin/jshint --verbose o/lib

documentation :
	node_modules/groc/bin/groc --except "**/node_modules/**" --except "o/**" --except "**/*.d.ts" "**/*.ts" README.md

test: unittest cucumber

unittest: compile lint
	node_modules/mocha/bin/mocha --timeout 5s --reporter=spec --ui tdd

cucumber: test-tinkerpop
	./node_modules/.bin/cucumber-js --tags '~@todo'

TS_SRC=$(filter-out %.d.ts,$(wildcard bin/*.ts lib/*.ts test/*.ts features/step_definitions/*.ts))
TS_OBJ=$(patsubst %.ts,%.js,$(TS_SRC))
TS_JSMAP=$(patsubst %.ts,%.js.map,$(TS_SRC))
TSC=./node_modules/.bin/tsc
TSC_OPTS=--module commonjs --target ES5 --sourceMap

compile: $(TS_OBJ)

%.js: %.ts
	$(TSC) $(TSC_OPTS) $<
	stat $@ > /dev/null

clean: clean-cucumber clean-doc clean-js-map clean-npm clean-obj clean-tsd clean-unittest clean-tinkerpop

clean-cucumber:
	rm -rf o.features

clean-doc:
	rm -rf doc

clean-js-map:
	rm -f $(TS_JSMAP)

clean-npm:
	rm -rf node_modules

clean-obj:
	rm -f $(TS_OBJ)

clean-tsd:
	rm -rf typings

clean-unittest:
	rm -rf o/*

install:
	$(MAKE) install-npm
	$(MAKE) install-tsd
	$(MAKE) install-tinkerpop

install-npm:
	npm install

TSD=./node_modules/.bin/tsd

install-tsd:
	$(TSD) reinstall

install-tinkerpop:
	cd tinkerpop && mvn clean package

test-tinkerpop: compile lint
	cd tinkerpop && node ../bin/ts-java.js

clean-tinkerpop:
	cd tinkerpop && mvn clean
	rm -rf tinkerpop/java.d.ts tinkerpop/o

# Explicit dependencies for files that are referenced

bin/ts-java.js: lib/work.js lib/classes-map.js lib/code-writer.js

lib/classes-map.js : lib/work.js

lib/code-writer.js : lib/classes-map.js
