'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Rooms', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "public"
    });

    await queryInterface.changeColumn('Rooms', 'password', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // reversa por si necesitas revertir la migración
    await queryInterface.changeColumn('Rooms', 'type', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.changeColumn('Rooms', 'password', {
      type: Sequelize.STRING,
      allowNull: false
    });
  }
};
