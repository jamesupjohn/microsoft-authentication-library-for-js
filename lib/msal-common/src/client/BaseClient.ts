/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ClientConfiguration, buildClientConfiguration } from "../config/ClientConfiguration";
import { ICacheStorage } from "../cache/ICacheStorage";
import { CacheHelpers } from "../cache/CacheHelpers";
import { INetworkModule } from "../network/INetworkModule";
import { ICrypto } from "../crypto/ICrypto";
import { Account } from "../account/Account";
import { Authority } from "../authority/Authority";
import { Logger } from "../logger/Logger";
import { AADServerParamKeys, Constants, HeaderNames } from "../utils/Constants";
import { NetworkResponse } from "../network/NetworkManager";
import { ServerAuthorizationTokenResponse } from "../server/ServerAuthorizationTokenResponse";
import { B2cAuthority } from "../authority/B2cAuthority";
import { UnifiedCacheManager } from "../unifiedCache/UnifiedCacheManager";
import { IAccount } from "../account/IAccount";
import { AccountCache } from "../unifiedCache/utils/CacheTypes";
import { AccountEntity } from "../unifiedCache/entities/AccountEntity";

/**
 * Base application class which will construct requests to send to and handle responses from the Microsoft STS using the authorization code flow.
 */
export abstract class BaseClient {

    // Logger object
    public logger: Logger;

    // Application config
    protected config: ClientConfiguration;

    // Crypto Interface
    protected cryptoUtils: ICrypto;

    // Storage Interface
    protected cacheStorage: ICacheStorage;

    // Network Interface
    protected networkClient: INetworkModule;

    // Helper API object for running cache functions
    protected spaCacheManager: CacheHelpers;

    // Helper API object for serialized cache operations
    protected unifiedCacheManager: UnifiedCacheManager;

    // Account object
    protected account: Account;

    // Default authority object
    protected defaultAuthority: Authority;

    protected constructor(configuration: ClientConfiguration) {
        // Set the configuration
        this.config = buildClientConfiguration(configuration);

        // Initialize the logger
        this.logger = new Logger(this.config.loggerOptions);

        // Initialize crypto
        this.cryptoUtils = this.config.cryptoInterface;

        // Initialize storage interface
        this.cacheStorage = this.config.storageInterface;

        // Initialize storage helper object
        this.spaCacheManager = new CacheHelpers(this.cacheStorage);

        // Initialize serialized cache manager
        this.unifiedCacheManager = new UnifiedCacheManager(this.cacheStorage, this.config.systemOptions.storeInMemory);

        // Set the network interface
        this.networkClient = this.config.networkInterface;

        B2cAuthority.setKnownAuthorities(this.config.authOptions.knownAuthorities);

        this.defaultAuthority = this.config.authOptions.authority;
    }

    /**
     * Creates default headers for requests to token endpoint
     */
    protected createDefaultTokenRequestHeaders(): Map<string, string> {

        const headers = this.createDefaultLibraryHeaders();
        headers.set(HeaderNames.CONTENT_TYPE, Constants.URL_FORM_CONTENT_TYPE);

        return headers;
    }

    /**
     * addLibraryData
     */
    protected createDefaultLibraryHeaders(): Map<string, string> {
        const headers = new Map<string, string>();
        // client info headers
        headers.set(`${AADServerParamKeys.X_CLIENT_SKU}`, this.config.libraryInfo.sku);
        headers.set(`${AADServerParamKeys.X_CLIENT_VER}`, this.config.libraryInfo.version);
        headers.set(`${AADServerParamKeys.X_CLIENT_OS}`, this.config.libraryInfo.os);
        headers.set(`${AADServerParamKeys.X_CLIENT_CPU}`, this.config.libraryInfo.cpu);

        return headers;
    }

    /**
     * Http post to token endpoint
     * @param tokenEndpoint
     * @param queryString
     * @param headers
     */
    protected executePostToTokenEndpoint(
        tokenEndpoint: string,
        queryString: string,
        headers: Map<string, string> ): Promise<NetworkResponse<ServerAuthorizationTokenResponse>> {

        return this.networkClient.sendPostRequestAsync<ServerAuthorizationTokenResponse>(
            tokenEndpoint,
            {
                body: queryString,
                headers: headers,
            });
    }

    /**
     * Get all currently signed in accounts.
     */
    public getAllAccounts(): IAccount[] {
        const currentAccounts: AccountCache = this.unifiedCacheManager.getAllAccounts();
        console.log("Current Accounts Obj: " , currentAccounts);
        const accountValues: AccountEntity[] = Object.values(currentAccounts);
        console.log("Accounts: " , accountValues);
        const numAccounts = accountValues.length;
        if (numAccounts < 1) {
            return null;
        } else {
            return accountValues.map<IAccount>((value) => {
                return {
                    homeAccountId: value.homeAccountId,
                    localAccountId: value.localAccountId,
                    environment: value.environment,
                    tenantId: value.realm,
                    userName: value.username
                };
            });
        }
    }
}
