.PHONY: install install-npm install-tsd lint documentation test testdata unittest cucumber compile
.PHONY: clean clean-obj clean-tsd clean-npm clean-js-map clean-unittest clean-cucumber
.PHONY: install-java-pkgs build-java-pkgs clean-java-pkgs

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

cucumber: build-java-pkgs
	./node_modules/.bin/cucumber-js --tags '~@todo' --require features/step_definitions

TS_SRC=$(filter-out %.d.ts,$(wildcard bin/*.ts lib/*.ts test/*.ts features/step_definitions/*.ts))
TS_OBJ=$(patsubst %.ts,%.js,$(TS_SRC))
TS_JSMAP=$(patsubst %.ts,%.js.map,$(TS_SRC))
TSC=./node_modules/.bin/tsc
TSC_OPTS=--module commonjs --target ES5 --sourceMap

compile: $(TS_OBJ)

%.js: %.ts
	$(TSC) $(TSC_OPTS) $<
	stat $@ > /dev/null

clean: clean-cucumber clean-doc clean-js-map clean-npm clean-obj clean-tsd clean-unittest clean-java-pkgs

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
	$(MAKE) install-java-pkgs

install-npm:
	npm install

TSD=./node_modules/.bin/tsd

install-tsd:
	$(TSD) reinstall

######
# JAVAPKGS are directories containing a pom.xml and a package.json in which ts-java will be run
# to generate a java.d.ts file. Keep the packages in alphabetical order.
# Note that cucumber tests depend on these packages being 'built' by the build-java-pkgs target.
JAVAPKGS=\
	reflection \
	tinkerpop \

JAVAPKGS_INSTALL=$(patsubst %,%-install,$(JAVAPKGS))
JAVAPKGS_BUILD=$(patsubst %,%-build,$(JAVAPKGS))
JAVAPKGS_CLEAN=$(patsubst %,%-clean,$(JAVAPKGS))

.PHONY: $(JAVAPKGS_INSTALL) $(JAVAPKGS_BUILD) $(JAVAPKGS_CLEAN)

install-java-pkgs : $(JAVAPKGS_INSTALL)

build-java-pkgs : $(JAVAPKGS_BUILD)

clean-java-pkgs : $(JAVAPKGS_CLEAN)

$(JAVAPKGS_INSTALL): %-install:
	cd $* && mvn clean package

$(JAVAPKGS_BUILD): %-build: bin/ts-java.js
	cd $* && node ../bin/ts-java.js

$(JAVAPKGS_CLEAN): %-clean:
	cd $* && mvn clean
	rm -rf $*/java.d.ts $*/o

#####
# Explicit dependencies for files that are referenced

lib/*.js test/*.js: lib/java.d.ts

bin/ts-java.js: lib/work.js lib/classes-map.js lib/code-writer.js lib/java.d.ts

lib/classes-map.js : lib/work.js

lib/code-writer.js : lib/classes-map.js


