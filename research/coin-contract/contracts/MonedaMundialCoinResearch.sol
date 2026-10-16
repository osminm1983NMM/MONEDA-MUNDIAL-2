// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MonedaMundialCoinResearch
 * @notice SOLAMENTE UN PROTOTIPO ABSTRACTO: no es desplegable.
 *
 * Ejemplo técnico de la alternativa "oferta fija al iniciar".
 * NO selecciona un número de monedas, precio, ticker definitivo, red,
 * gobernanza ni mecanismo de venta. No se ha creado ningún activo.
 *
 * Es abstracto deliberadamente para impedir generar un contrato final
 * por accidente. No hay claves, dueño privilegiado ni funciones de acuñación
 * posteriores, de cambio de supply, de venta o de intercambio.
 *
 * La arquitectura de emisión programada sigue como escenario ALTERNATIVO
 * pendiente de revisión legal, económica y auditoría.
 */
abstract contract MonedaMundialCoinResearch is ERC20 {
    error InvalidResearchRecipient();
    error InvalidResearchSupply();

    constructor(address hypotheticalDistributionVault, uint256 hypotheticalBaseUnitSupply)
        ERC20("Moneda Mundial Coin — INVESTIGACIÓN", "MWD-RESEARCH")
    {
        if (hypotheticalDistributionVault == address(0)) {
            revert InvalidResearchRecipient();
        }
        if (hypotheticalBaseUnitSupply == 0) {
            revert InvalidResearchSupply();
        }
        // La acuñación sólo sería posible en la construcción de un
        // contrato concreto FUTURO tras aprobación regulatoria y auditoría.
        _mint(hypotheticalDistributionVault, hypotheticalBaseUnitSupply);
    }
}
