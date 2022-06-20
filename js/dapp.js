DApp = {
    web3Provider: null,
    factoryContract: null,
    walletContract: null,
    toptalTokenContract: null,
    currentAccount: null,
    table: null,
    wallets: {},

    // set to true to use with local blockchain
    development: false,
    //Rinkeby:
    factoryAddress: "0x024E6E067134B93e17A9340Df3BE72716dd28aaE",

    init: function() {
        console.log("[x] Initializing DApp.");
        this.initWeb3();
        this.initContract();
    },

    /**************************************************************************
     * Smart Contracts interaction methods.
     *************************************************************************/

    initWeb3: function() {
        // Is there is an injected web3 instance?
        if (typeof ethereum !== 'undefined') {
          DApp.web3Provider = ethereum;
        }

        web3 = new Web3(DApp.web3Provider);
        console.log("[x] web3 object initialized.");

        ethereum.on('accountsChanged', (accounts) => {
            DApp.currentAccount = accounts[0];
            $('#currentWallet').html("Current wallet: " + accounts[0]);
          });

        ethereum.on('chainChanged', (chainId) => {
            window.location.reload();
          });
    },

    getFactoryContract: function(){
        return DApp.factoryContract.at(DApp.factoryAddress);
    },

    

    /**
     *  TODO: Rewrite to use promises.
     */
    initContract: function(){
        $.getJSON('../contracts/OTCWalletFactory.json', function(factoryContract){
            DApp.factoryContract = TruffleContract(factoryContract);
            DApp.factoryContract.setProvider(DApp.web3Provider);
            console.log("[x] OTCWalletFactory contract initialized.");

            //hardcoding ToptalToken for simplicity
            // $.getJSON('../contracts/ToptalToken.json', function(toptalTokenContract){
            //     DApp.toptalTokenContract = TruffleContract(toptalTokenContract);
            //     DApp.toptalTokenContract.setProvider(DApp.web3Provider);
            //     console.log("[x] ToptalToken contract initialized.");

                $.getJSON('../contracts/OTCWallet.json', (walletContract) => {
                    DApp.walletContract = TruffleContract(walletContract)
                    DApp.walletContract.setProvider(DApp.web3Provider);
                    console.log("[x] OTCWallet contract initialized.");


                    console.log(ethereum);

                    ethereum.request({ method: 'eth_requestAccounts' }).then( accounts => {
                        if (accounts.length) {
                            DApp.currentAccount = accounts[0];
                            $('#currentWallet').html("Current wallet: " + accounts[0]);
                            console.log("[x] Using account", DApp.currentAccount);
                            DApp.initCreateWalletForm();
                            DApp.prefillCreateWalletForm();
                            DApp.initTable();
                            DApp.loadWallets();
                            DApp.initClaimForm();
                        } 
                    }).catch((e) => console.log(e));
    
                  
                    
                    
                });
            // });
        });
    },



    loadWallets: function(){
        $("#loader").show();
        DApp.factoryContract.at(DApp.factoryAddress)
            .then(function(factoryInstance){
                return factoryInstance.getWallets(DApp.currentAccount);
            })
            .then(function(walletAddresses){
                console.log("[x] Number of existing wallets:", walletAddresses.length);
                walletAddresses.forEach(DApp.loadSingleWallet);
            })
            .finally(function(){
                $("#loader").hide();
            });
    },

    loadSingleWallet: function(walletAddress){
        DApp.walletContract.at(walletAddress)
            .then(function(walletInstance){
                return walletInstance.info();
            })
            .then(function(info){
                var from        = info[0];
                var to          = info[1];
                var createdAt   = info[2].toNumber();
                var ether       = info[3];
                //
                // if (ether > 0) {
                    DApp.addWalletToTable(from, to, walletAddress, createdAt);
                    DApp.addFundsToWallet(walletAddress, 'wei', `${ether}`);
                // }
            });
    },

    withdrawToSeller: function(walletAddress){
        $("#loader").show();
        DApp.walletContract.at(walletAddress)
            .then(function(walletInstance){

                return walletInstance.withdrawToSeller({from: DApp.currentAccount});
            })
            .then(function(){
                console.log(`DONE`);
                location.reload();

            })
            .finally(function(){
                $("#loader").hide();
            });
    },


    createNewWallet: function(receiverAddress, ethAmount){
        $("#loader").show();
        DApp.factoryContract.at(DApp.factoryAddress)
            .then(function(factoryInstance){
                var tx = {
                    from: DApp.currentAccount,
                    value: web3.utils.toWei(ethAmount, "ether")
                };
                return factoryInstance.newOTCWallet(receiverAddress, tx);
            })
            .then(function(tx){
                var createdEvent = tx.logs[0].args;
                var from        = createdEvent.from;
                var to          = createdEvent.to;
                var wallet      = createdEvent.wallet;
                var createdAt   = createdEvent.createdAt.toNumber();
                var ether       = createdEvent.amount;

                DApp.addFundsToWallet(wallet, 'wei', ether);
                DApp.addWalletToTable(from, to, wallet, createdAt);
            })
            .finally(function() {
                $("#loader").hide();
            });
    },

    claimFunds: function(walletAddress, receiverJudgeAddress,){
        $("#loader").show();
        DApp.walletContract.at(walletAddress)
            .then(function(walletInstance){
                return walletInstance.judgeWithdraw(receiverJudgeAddress, {from: DApp.currentAccount});
            })
            .catch((e) => {
                alert(`You are not JUDGE`)
            })
            .then(function(tx){
                var withdrawEvent = tx.logs[0].args;
                console.log(`DONE WJUDGE`);
                console.log(withdrawEvent);
            })
            .finally(function() {
                $("#loader").hide();
            });
    },

    topupWallet: function(walletAddress, amount, currency){
        // if(currency === "ether") {
        //     console.log("Topup with plain old Ether");
        //     DApp.walletContract.at(walletAddress)
        //         .then(function(walletInstance){
        //             return walletInstance.send(web3.toWei(amount, "ether"), {from: DApp.currentAccount});
        //         })
        //         .then(function(tx){
        //             console.log(tx);
        //             createdEvent = tx.logs[0].args;
        //             var from   = createdEvent.from;
        //             var amount = createdEvent.amount.toNumber();

        //             DApp.addFundsToWallet(walletAddress, 'wei', amount);
        //         });
        // } else if(currency === "toptaltoken") {
        //     console.log("Topup Toptal Token");
        //     DApp.getToptalTokenContract()
        //         .then(function(tokenInstance){
        //             return tokenInstance.transfer(walletAddress, amount, {from: DApp.currentAccount});
        //         })
        //         .then(function(tx){
        //             console.log(tx);
        //             transferEvent = tx.logs[0].args;
        //             var from = transferEvent.from;
        //             var amount = transferEvent.value.toNumber()

        //             DApp.addFundsToWallet(walletAddress, 'toptaltoken', amount);
        //         });
        // } else {
        //     throw new Error("Unknown currency!");
        // }
    },

    /**************************************************************************
     * Wallet amounts tracking methods.
     *************************************************************************/    
    addFundsToWallet: function(walletAddress, token, amount){
        if(typeof DApp.wallets[walletAddress] == "undefined"){
            DApp.wallets[walletAddress] = {};
        }
        if(typeof DApp.wallets[walletAddress][token] == "undefined"){
            DApp.wallets[walletAddress][token] = 0;
        }
        console.log("addFundsToWallet", walletAddress, token, amount)
        DApp.wallets[walletAddress][token] += amount;

        //refresh doesn't work so using a workaround
        //DApp.table.bootstrapTable('refresh');
        DApp.table.bootstrapTable('updateRow', {index: 1000, row: null})
    },

    getKnownWalletBallance: function(walletAddress, token){
        if(typeof DApp.wallets[walletAddress] == "undefined") return 0;
        if(typeof DApp.wallets[walletAddress][token] == "undefined") return 0;
        var value = DApp.wallets[walletAddress][token];
        console.log(walletAddress, token, value);
        return value
    },

    /**************************************************************************
     * Form methods.
     *************************************************************************/
    initCreateWalletForm: function(){
        $("#create-wallet-form").submit(function(event) {
            event.preventDefault();
            var form = $(this);
            var ethAddress = form.find("#ethereumAddress").val().trim();
            var ethAmount = form.find("#etherAmount").val().trim();
            
            DApp.createNewWallet(ethAddress, ethAmount);
        });
    },

    prefillCreateWalletForm: function(){
        // $("#create-wallet-form #ethereumAddress").val(DApp.currentAccount);
        $("#create-wallet-form #etherAmount").val(0.0);
        var date = new Date();
        date.setMinutes(date.getMinutes() + 10);
        date = date.toISOString();
        date = date.slice(0, -8)
        $("#create-wallet-form #unlockDate").val(date);
    },

    initTopupWalletForm: function(){
        console.log("initTopupWalletForm");
        $("#topup-wallet-form").submit(function(event) {
            event.preventDefault();
            var form = $(this);
            var targetWalletAddress = form.find('#knownWalletAddresses option').filter(":selected").val();
            var amount = form.find("#amount").val();
            var currency = form.find("#currency").val();
            console.log("[r] " + targetWalletAddress + "; " + amount + "; " + currency)
            DApp.topupWallet(targetWalletAddress, amount, currency);
        });
    },

    updateKnownWalletAddresses: function(walletAddress){
        // Add new address option to dropdown.
        $("#knownWalletAddresses").append("<option value='" + walletAddress + "'>" + walletAddress + "</option>");

        // Get rid of duplicate addresses
        var usedNames = {};
        $("select[id='knownWalletAddresses'] > option").each(function () {
            if(usedNames[this.text]) {
                $(this).remove();
            } else {
                usedNames[this.text] = this.value;
            }
        });
    },

    updateClaimWalletAddresses: function(walletAddress, to){
        //Only pick owned accounts
        if(DApp.currentAccount === to){
            // Add new address option to dropdown.
            $("#claimWalletAddresses").append("<option value='" + walletAddress + "'>" + walletAddress + "</option>");

            // Get rid of duplicate addresses
            var usedNames = {};
            $("select[id='claimWalletAddresses'] > option").each(function () {
                if(usedNames[this.text]) {
                    $(this).remove();
                } else {
                    usedNames[this.text] = this.value;
                }
            });
        }
    },

    updateClaimForm: function(){
        var form = $('#claim-funds-form');
        var wallet = $('#claimWalletAddresses').val();
        var currency = form.find("#claimableCurrency").val();
        if(currency == "ether"){
            var weiValue = DApp.getKnownWalletBallance(wallet, 'wei');
            var ethValue = web3.utils.fromWei(weiValue, 'ether');
            form.find("#claimableAmount").val(ethValue);
        }
    },

    initClaimForm: function(){
        console.log("initClaimForm");

        $("#claim-funds-form").submit(function(event) {
            event.preventDefault();
            var form = $(this);
            
            var contractWallet = form.find("#contractWalletAddresses").val();
            var receiverJudgeAddress = form.find("#receiverWalletAddresses").val();

            DApp.claimFunds(contractWallet, receiverJudgeAddress);
        });
    },


    /**************************************************************************
     * Table methods
     *************************************************************************/
    initTable: function(){
        DApp.table = $("#wallets-table");
        DApp.table.bootstrapTable({
            iconsPrefix: 'fa',
            icons: {
                // paginationSwitchDown: 'glyphicon-collapse-down icon-chevron-down',
                // paginationSwitchUp: 'glyphicon-collapse-up icon-chevron-up',
                // refresh: 'glyphicon-refresh icon-refresh',
                // toggle: 'glyphicon-list-alt icon-list-alt',
                // columns: 'glyphicon-th icon-th',
                detailOpen: 'fa-plus',
                detailClose: 'fa-minus'
            },
            detailView: true,
            detailFormatter: DApp.detailFormatter,
            sortName: 'createdAt',
            sortOrder: 'desc',
            columns: [
                { 
                    field: 'from', 
                    title: 'From',
                    formatter: DApp.hashFormatter,
                    searchable: true
                }, { 
                    field: 'type',        
                    title: 'Type',
                    formatter: DApp.typeFormatter       
                },{ 
                    field: 'to',
                    title: 'To',
                    formatter: DApp.hashFormatter
                },{ 
                    field: 'wallet',      
                    title: 'Wallet',
                    formatter: DApp.hashFormatter     
                },{ 
                    field: 'createdAt',
                    title: 'Age',
                    formatter: DApp.dateFormatter,
                    sortable: true
                },{ 
                    field: 'value',
                    title: "Value",
                    formatter: DApp.valueFormatter,
                    sortable: false
                },{ 
                    field: 'actions',
                    title: "Actions",
                    formatter: DApp.actionFormatter
                }
            ],
        });
    },

    addWalletToTable: function(from, to, wallet, createdAt, value, currency = "Ether"){
        newRow = {
            type: DApp.discoverType(from, to),
            from: from,
            to: to,
            wallet, wallet,
            createdAt: createdAt,
        }
        DApp.table.bootstrapTable('append', newRow);

        DApp.updateKnownWalletAddresses(wallet);
        DApp.updateClaimWalletAddresses(wallet, to);
    },

    discoverType: function(from, to){
        from = from.toLowerCase();
        to = to.toLowerCase();

        if(from == to && from == DApp.currentAccount){
            return "self";
        } else if(from == DApp.currentAccount){
            return "out";
        } else if(to == DApp.currentAccount){
            return "in";
        } else {
            throw new Error("Unknown type!");
        }
    },

    typeFormatter: function(type){
        var badgeClass = {
            "self": "badge-info",
            "in":   "badge-success",
            "out":  "badge-warning"
        };

        return `<span class="badge ${badgeClass[type]}">${type}</span>`;
    },

    hashFormatter: function(hash, row, index){
        shortHash = hash.slice(0, 10);
        return `<a href="https://rinkeby.etherscan.io/address/${hash}">${shortHash}...</a>`;
    },

    dateFormatter: function(timestamp, row, index){
        return moment(timestamp*1000).fromNow();
    },

    valueFormatter: function(cell, row){
        var weiValue = DApp.getKnownWalletBallance(row['wallet'], 'wei');
        var ethValue = web3.utils.fromWei(`${weiValue}`, 'ether');
        // var toptalValue = DApp.getKnownWalletBallance(row['wallet'], 'toptaltoken')

        console.log("xxxx", row['wallet'], ethValue);

        if(ethValue == 0 ){
            return 'Wallet empty';
        } 
        var html = '';
        if(ethValue > 0) { html += `${ethValue} Ether</br>`}

        return html;
    },

    detailFormatter: function(index, row){
        console.log("asd")
        var table = $("<table></table");
        return table.bootstrapTable({
            showHeader: false,
            columns: [
                { 
                    field: 'key', 
                    title: 'Key',
                    cellStyle: DApp.detailViewKeyColumnFormatter 
                }, { 
                    field: 'value',        
                    title: 'Value',
                }
            ],
            data: [
                {
                    key: "From",
                    value: row['from']
                }, {
                    key: "Type",
                    value: DApp.typeFormatter(row['type'])
                },{
                    key: "To",
                    value: row['to']
                },{
                    key: "Wallet Address",
                    value: row['wallet']
                },{
                    key: "Age",
                    value: DApp.dateFormatter(row['createdAt'])
                },{
                    key: "Value",
                    value: DApp.valueFormatter(false, row)
                }
            ],
        });
    },

    detailViewKeyColumnFormatter: function(value, row, index, field){
        return {
            classes: 'font-weight-bold',
        };
    },

    actionFormatter: function(value, row, index, field){
        let html = ``;

        
        var weiValue = DApp.getKnownWalletBallance(row['wallet'], 'wei');

        console.log(`WEI: ` + Number(weiValue))

        if(row["to"].toLowerCase() != DApp.currentAccount.toLowerCase() && Number(weiValue) > 0) {
            html = `<button class="btn btn-danger" onClick="DApp.handleStoSButtonClick('${row['wallet']}')">Send to Seller</button>`;
        } else {
            // var html = `<button class="btn btn-danger" onClick="DApp.handleTopupButtonClick('${row['wallet']}')">Topup</button>`;
            html = ``;
        }
        return html;
    },

    handleTopupButtonClick: function(walletAddress){
        $('#knownWalletAddresses').val(walletAddress).change();
        $('#topup-tab').tab('show');
    },

    handleClaimButtonClick: function(walletAddress){
        $('#claimWalletAddresses').val(walletAddress).change();
        DApp.updateClaimForm();
        $('#claim-tab').tab('show');
    },

    handleStoSButtonClick: function(walletAddress){
        DApp.withdrawToSeller(walletAddress);
    }
}

$(function() {
    DApp.init();
});
