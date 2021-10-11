PROGRAM_ID=6jnS9rvUGxu4TpwwuCeF12Ar9Cqk2vKbufqc6Hnharnz
PROGRAM_DEPLOY_ACCOUNT=BSKmmWSyV42Pw3AwZHRFyiHpcBpQ3FyCYeHVecUanb6y

ifneq (,$(wildcard ./.env))
	include ./.env
endif


.PHONY: build deploy build-client run listen deploy-new

build:
	anchor build -p oracle

# Only use this when you want to deploy the program at a new address (or for the first time)
# otherwise use the "deploy" to deploy to the old address
deploy-new:
	anchor deploy -p oracle

# Use these whenever you already have a program id
deploy:
	anchor upgrade ./target/deploy/oracle.so --program-id $(PROGRAM_ID)

## Listen to on-chain logs
listen:
	solana logs $(PROGRAM_ID)


## Client side
build-client:
	npm run build

run:
	npm run start

airdrop:
	solana airdrop 5 ${BSKmmWSyV42Pw3AwZHRFyiHpcBpQ3FyCYeHVecUanb6y} --url http://127.0.0.1:8899